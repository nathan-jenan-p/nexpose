polarity.export = PolarityComponent.extend({
    details: Ember.computed.alias('block.data.details'),
    selfLink: Ember.computed('block.data.details', function () {
        return this.get('block.data.details').links.filter(function (link) {
            return link.rel === 'self';
        }).pop();
    })
});
