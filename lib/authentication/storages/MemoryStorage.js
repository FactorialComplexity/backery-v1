var _ = require('lodash');

var MemoryStorage = function(config, Backery) {
    var data = { };
    
    setTimeout(function() {
        var d = data;
        var ct = new Date();
        data = { };
        
        _.each(d, function(value, key) {
            if (value.expires < ct) {
                data[key] = value;
            }
        });
    }, 5 * 60 * 1000); // once in 5 minutes purge expired tokens
    
    this.storeAccessToken = function(accessToken, clientId, expires, user) {
        data[accessToken] = {
            expires: expires,
            clientId: clientId,
            user: user.toJSON({
                verbose: true,
                access: {
                    isUser: true,
                    isUserOwner: true
                }
            })
        };
        
        return Backery.Promise.resolve();
    }
    
    this.fetchAccessToken = function(accessToken) {
        var found = data[accessToken];
        var ct = new Date();
        
        if (found && found.expires > ct) {
            return Backery.Promise.resolve({
                token: accessToken,
                expires: found.expires,
                user: Backery.Object.load(found.user)
            });
        } else {
            return Backery.Promise.resolve();
        }
    }
}

module.exports = MemoryStorage;
