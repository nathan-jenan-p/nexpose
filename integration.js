let async = require('async');
let config = require('./config/config');
let request = require('request');

let Logger;
let requestWithDefaults;
let requestOptions = {};

function handleRequestError(request) {
    return (options, expectedStatusCode, callback) => {
        return request(options, (err, resp, body) => {
            if (err || resp.statusCode !== expectedStatusCode) {
                Logger.error(`error during http request to ${options.url}`, { error: err, status: resp ? resp.statusCode : 'unknown' });
                callback({ error: err, statusCode: resp ? resp.statusCode : 'unknown' });
            } else {
                callback(null, body);
            }
        });
    };
}

function allEmptyResults(entities) {
    return entities.map(entity => {
        return {
            entity: entity,
            data: null
        };
    });
}

function doLookup(entities, options, callback) {
    Logger.trace('options are', options);

    let requestBody = {
        filters: entities
            .filter(entity => entity.isIP)
            .map(entity => {
                return {
                    field: "ip-address",
                    operator: "is",
                    value: entity.value
                };
            }),
        match: "any"
    };

    let ro = {
        url: `${options.url}/api/3/assets/search`,
        method: 'POST',
        auth: {
            user: options.username,
            password: options.password
        },
        body: requestBody,
        json: true
    };

    Logger.trace('request options are: ', ro);

    requestWithDefaults(ro, 200, (err, body) => {
        if (err) {
            Logger.error('error during lookup', err);
            callback(null, err);
            return;
        }

        let resourcesByIP = {};

        body.resources.forEach(resource => {
            resourcesByIP[resource.ip] = resource;
        });

        let results = [];

        entities.forEach(entity => {
            let resource = resourcesByIP[entity.value];
            if (!!resource) {
                results.push({
                    entity: entity,
                    data: {
                        summary: [
                            `Critical: ${resource.vulnerabilities.critical}`,
                            `Severe: ${resource.vulnerabilities.severe}`,
                            `Exploits: ${resource.vulnerabilities.exploits}`,
                            `Services: ${resource.services.reduce((prev, next) => prev + ', ' + next.name, '')}`
                        ],
                        details: resource
                    }
                });
            } else {
                results.push({
                    entity: entity,
                    data: null
                });
            }
        });

        callback(null, results);
    });
}

function onDetails(entity, options, callback) {
    let ro = {
        url: `${options.url}/api/3/tags`,
        auth: {
            user: options.username,
            password: options.password
        },
        json: true
    };

    Logger.trace('request options are: ', ro);

    requestWithDefaults(ro, 200, (err, body) => {
        if (err) {
            callback(err);
            return;
        }

        entity.data.details.availableTags = body.resources;

        ro.url = `${options.url}/api/3/assets/${entity.data.details.id}/tags`;

        requestWithDefaults(ro, 200, (err, body) => {
            if (err) {
                callback(err);
                return;
            }

            entity.data.details.appliedTags = body.resources;

            callback(null, entity.data);
        });
    });
}

function startup(logger) {
    Logger = logger;

    if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
        requestOptions.cert = fs.readFileSync(config.request.cert);
    }

    if (typeof config.request.key === 'string' && config.request.key.length > 0) {
        requestOptions.key = fs.readFileSync(config.request.key);
    }

    if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
        requestOptions.passphrase = config.request.passphrase;
    }

    if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
        requestOptions.ca = fs.readFileSync(config.request.ca);
    }

    if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
        requestOptions.proxy = config.request.proxy;
    }

    if (typeof config.request.rejectUnauthorized === 'boolean') {
        requestOptions.rejectUnauthorized = config.request.rejectUnauthorized;
    }

    requestOptions.json = true;

    requestWithDefaults = handleRequestError(request.defaults(requestOptions));
}

function validateStringOption(errors, options, optionName, errMessage) {
    if (typeof options[optionName].value !== 'string' ||
        (typeof options[optionName].value === 'string' && options[optionName].value.length === 0)) {
        errors.push({
            key: optionName,
            message: errMessage
        });
    }
}

function onMessage(payload, options, callback) {
    let ro = {
        url: `${options.url}/api/3/tags/${payload.tagId}/assets/${payload.assetId}`,
        method: 'PUT',
        auth: {
            user: options.username,
            password: options.password
        },
        json: true
    };

    Logger.trace('request options are: ', ro);

    requestWithDefaults(ro, 200, (err) => {
        if (err) {
            callback(err);
            return;
        }

        callback();
    });
}

function validateOptions(options, callback) {
    let errors = [];

    validateStringOption(errors, options, 'url', 'You must provide an example ');
    validateStringOption(errors, options, 'username', 'You must provide an example option.');
    validateStringOption(errors, options, 'password', 'You must provide an example option.');

    callback(null, errors);
}

module.exports = {
    doLookup: doLookup,
    onDetails: onDetails,
    onMessage: onMessage,
    startup: startup,
    validateOptions: validateOptions
};
