var util = require('util');
var _ = require('lodash');

var BackeryObject = require('./BackeryObject.js');

var BackeryInstallation = function(impl, Backery){

    BackeryObject.apply(this, arguments);

    var _super = {
        save: this.save
    };

    var self = this;

    this.save = function() {
        if (self.isNew() ||
            (self.changed('apnsToken') && self.get('apnsToken')) ||
            (self.changed('gcmToken') && self.get('gcmToken'))) {
            
            return Backery.Model.Installation.query().where('apnsToken', self.get('apnsToken')).or('gcmToken', self.get('gcmToken')).find().then(function (installations) {
                return Backery.Promise.all(_.map(installations, function (installation) {
                    if (self.get('apnsToken') == installation.get('apnsToken')) {
                        installation.set('apnsToken', null);
                    }

                    if (self.get('gcmToken') == installation.get('gcmToken')) {
                        installation.set('gcmToken', null);
                    }

                    return installation.save();
                }));
            }).then(function () {
                return _super.save();
            });
        } else {
            return _super.save();
        }
    }
};

util.inherits(BackeryInstallation, BackeryObject);

module.exports = BackeryInstallation;
