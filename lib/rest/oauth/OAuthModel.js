var errors = require('../../utils/errors.js');

OAuthModel = function(application) {
    this.application = application;
    this.extendedGrantHandlers = { };
}

// Client
OAuthModel.prototype.getClient = function(clientId, clientSecret, callback) {
    if (this.application.hasOAuth2Client(clientId, clientSecret)) {
        callback(undefined, { clientId: clientId });
    } else {
        callback(); // invalid client
    }
}

OAuthModel.prototype.grantTypeAllowed = function(clientId, grantType, callback) {
    callback(undefined, true);
}


// Access Token
OAuthModel.prototype.getAccessToken = function(bearerToken, callback) {
    this.application.getModel().getAccessToken(bearerToken).then(function(result) {
        callback(undefined, {
            expires: result.expires,
            user: result.user
        });
    }, function(error) {
        callback(error);
    });
}

OAuthModel.prototype.saveAccessToken = function(accessToken, clientId, expires, user, callback) {
    this.application.getModel().saveAccessToken(accessToken, clientId, expires, user).then(function(result) {
        callback();
    }, function(error) {
        callback(error);
    });
}


// Refresh Token
OAuthModel.prototype.getRefreshToken = function(refreshToken, callback) {
    this.application.getModel().getRefreshToken(refreshToken).then(function(result) {
        callback(undefined, {
            clientId: result.clientId,
            expires: result.expires,
            user: result.user
        });
    }, function(error) {
        callback(error);
    });
}

OAuthModel.prototype.saveRefreshToken = function(refreshToken, clientId, expires, user, callback) {
    this.application.getModel().saveRefreshToken(refreshToken, clientId, expires, user).then(function(result) {
        callback();
    }, function(error) {
        callback(error);
    })
}


// User
OAuthModel.prototype.getUser = function(username, password, callback) {
    this.application.getModel().authUser('password', {
        username: username,
        password: password
    }).then(function(user) {
        if (user) {
            callback(undefined, {
                id: user.objectId(),
                object: user
            });
        } else {
            callback();
        }
    }, function(error) {
        if (error.name == 'BackeryConsistencyError')
            error = new errors.BackeryUnauthorizedError(error.message);
        callback(error);
    })
}

OAuthModel.prototype.setExtendedGrantHandler = function(grantType, handler) {
    this.extendedGrantHandlers[grantType] = handler;
}

OAuthModel.prototype.extendedGrant = function(grantType, req, callback) {
    var handler = this.extendedGrantHandlers[grantType];
    if (handler) {
        handler(req, function(error, user) {
            if (!error) {
                callback(undefined, true, user ? {
                    id: user.objectId(),
                    object: user
                } : undefined);
            } else {
                callback(error, true);
            }
        });
    } else {
        callback(undefined, false, undefined);
    }
}

module.exports = OAuthModel;
