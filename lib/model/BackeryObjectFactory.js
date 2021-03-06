var BackeryObject = require('./BackeryObject.js');
var BackeryUser = require('./BackeryUser.js');
var BackeryFile = require('./BackeryFile.js');
var BackeryFileInstallation = require('./BackeryInstallation');

var BackeryObjectFactory = function(databaseHooksProvider, Backery) {
    
    this.create = function(impl) {
        var hooks = databaseHooksProvider ?
            databaseHooksProvider.getDatabaseHooks(impl.getEntityDefinition()) : {
                afterFetch: function() { return Backery.Promise.resolve(); },
                beforeSave: function() { return Backery.Promise.resolve(); },
                afterSave: function() { return Backery.Promise.resolve(); },
                beforeDestroy: function() { return Backery.Promise.resolve(); },
                afterDestroy: function() { return Backery.Promise.resolve(); }
            };
        
        if (impl.getEntityDefinition().isUserEntity()) {
            return new BackeryUser(impl, Backery, hooks);
        } else if (impl.getEntityDefinition().isFileEntity()) {
            return new BackeryFile(impl, Backery, hooks);
        } else if (impl.getEntityDefinition().isInstallationEntity()) {
            return new BackeryFileInstallation(impl, Backery, hooks);
        } else {
            return new BackeryObject(impl, Backery, hooks);
        }
    }
    
    Object.defineProperty(this, 'databaseHooksProvider', { get: function() { return databaseHooksProvider; } });
}

module.exports = BackeryObjectFactory;
