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
        var apnsTokenChanged = (self.changed('apnsToken') && self.get('apnsToken'));
        var gcmTokenChanged = (self.changed('gcmToken') && self.get('gcmToken'));
        
        if (self.isNew()) {
            self.set('user', Backery.Context.user());
        }
        
        if (self.isNew() || apnsTokenChanged || gcmTokenChanged) {
            var cond;
            if (apnsTokenChanged) {
                cond = Backery.Eq('apnsToken', self.get('apnsToken'));
            }
            
            if (gcmTokenChanged) {
                cond = Backery.Or(
                    cond,
                    Backery.Eq('gcmToken', self.get('gcmToken'))
                );
            }
            
            return Backery.Model.Installation.query().where(cond).find().then(function (installations) {
                return Backery.Promise.all(_.map(installations, function (installation) {
                    if (self.get('apnsToken') == installation.get('apnsToken')) {
                        installation.set('apnsToken', null);
                    }

                    if (self.get('gcmToken') == installation.get('gcmToken')) {
                        installation.set('gcmToken', null);
                    }
                    
                    return installation.save();
                }));
            }).then(function() {
                return _super.save();
            });
        } else {
            return _super.save();
        }
    }
};

util.inherits(BackeryInstallation, BackeryObject);

module.exports = BackeryInstallation;
