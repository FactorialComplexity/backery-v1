var BackeryObject = require('./BackeryObject.js');
var BackeryUser = require('./BackeryUser.js');

var BackeryObjectFactory = function(Backery) {
    
    this.create = function(impl) {
        if (impl.getEntityDefinition().isUserEntity()) {
            return new BackeryUser(impl, Backery);
        } else {
            return new BackeryObject(impl, Backery);
        }
    }
}

module.exports = BackeryObjectFactory;
