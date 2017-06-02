var _ = require('lodash');

var MemoryStorage = function(config, Backery) {
    var data = { };
    var cachedUsers = { };
    
    setTimeout(function() {
        var d = data;
        var ct = new Date();
        data = { };
        cachedUsers = { };
        
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
            userId: user.objectId()
        };
        
        return Backery.Promise.resolve();
    }
    
    this.fetchAccessToken = function(accessToken) {
        var found = data[accessToken];
        var ct = new Date();
        var self = this;
        
        if (found && found.expires > ct) {
            
            return self.fetchUser(found.userId)
            .then(function(fetchedUser) {
                return {
                    token: accessToken,
                    expires: found.expires,
                    clientId: found.clientId,
                    user: fetchedUser
                };
            });
        } else {
            return Backery.Promise.resolve();
        }
    },
    
    this.fetchUser = function(userId) {
        var foundUser = cachedUsers[userId];
        var self = this;
        
        if (foundUser) {
            return Backery.Promise.resolve(Backery.Object.load(foundUser));
        } else {
            return self.storeUser(Backery.Model.User.load(userId));
        }
    },
    
    this.storeUser = function(user) {
        
        return Backery.Model.User.get(user.objectId()).then(function(fetchedUser) {
            
            cachedUsers[fetchedUser.objectId()] = fetchedUser.toJSON({
                verbose: true,
                access: {
                    isUser: true,
                    isUserOwner: true
                },
                serializeUserRoles: true
            });
            
            return Backery.Promise.resolve(fetchedUser);
        });

    }
}

module.exports = MemoryStorage;
