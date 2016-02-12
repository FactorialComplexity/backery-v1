var error = require('./oauth2-server/error');
var Grant = require('./oauth2-server/grant');
var Authorize = require('./oauth2-server/authorize');
var OAuthModel = require('./OAuthModel.js');

var OAuth = function(application) {
    var _application = application;
    var _grants = ['password','refresh_token'];
    var _config = {
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 1209600,
        authCodeLifetime: 30,

        regex: {
          clientId: /^[a-z0-9-_]{3,40}$/i,
          grantType: new RegExp('^(' + _grants.join('|') + ')$', 'i')
        },
        grants: ['refresh_token', 'password'],
        model: new OAuthModel(application)
    };
    
    var self = this;
    
    this.grantHandler = function(callback) {
        return function(req, res, next) {
            new Grant(_config, req, res, function(error, responseObject) {
                callback(req, res, next, error, responseObject);
            });
        }
    }
    
    this.grantUser = function(req, res, user, callback) {
        new Grant(_config, req, res, function(error, responseObject) {
            callback(error, responseObject);
        }, { id: user.objectId(), object: user });
    }
    
    this.authorizeHandler = function(callback) {
        return function(req, res, next) {
            if (req.header('Authorization') && req.header('Authorization').indexOf('Bearer') == 0) {
                return new Authorize(_config, req, function(error) {
                    callback(req, res, next, error);
                });
            } else {
                // We do not require any authorization at this point
                // It will checked later on
                next();
            }
        }
    }
}

module.exports = OAuth;
