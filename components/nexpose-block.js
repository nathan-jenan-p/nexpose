let tagId = 2; // high is the first tag in the list, so we let it default

polarity.export = PolarityComponent.extend({
    details: Ember.computed.alias('block.data.details'),
    selfLink: Ember.computed('block.data.details', function () {
        return this.get('block.data.details').links.filter(function (link) {
            return link.rel === 'self';
        }).pop();
    }),
    actions: {
        applyTag: function (assetId) {
            let self = this;

            this.sendIntegrationMessage({ assetId: assetId, tagId: tagId })
                .then(() => {
                    let details = self.get('block.data.details')
                    details.appliedTags.push({ name: 'new tag' });

                    self.set('block.data.details', details);
                    self.notifyPropertyChange('block.data.details');
                })
                .catch(err => {
                    console.error(err);

                    // TODO display error message
                });
        },
        onSelectTag: function (value) {
            tagId = value;
        }
    }
});
