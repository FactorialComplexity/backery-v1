var error = require('./oauth2-server/error');
var Grant = require('./oauth2-server/grant');
var Authorize = require('./oauth2-server/authorize');
var CookieAuthorize = require('./oauth2-server/cookie-authorize');
var OAuthModel = require('./OAuthModel.js');

var OAuth = function(application) {
    var _application = application;
    var _config = {
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 1209600,
        authCodeLifetime: 30,

        regex: {
          clientId: /^[a-z0-9-_]{3,40}$/i
        },
        grants: ['refresh_token', 'encrypted_token'],
        model: new OAuthModel(application)
    };
    
    var self = this;
    
    this.enablePassword = function() {
        _config.grants.push('password');
        _config.regex.grantType = new RegExp('^(' + _config.grants.join('|') + ')$', 'i');
    }
    
    this.enableFacebook = function(handler) {
        _config.grants.push('urn:facebook:access_token');
        _config.regex.grantType = new RegExp('^(' + _config.grants.join('|') + ')$', 'i');
        
        _config.model.setExtendedGrantHandler('urn:facebook:access_token', handler);
    }
    
    this.enableTwitter = function(handler) {
        _config.grants.push('urn:twitter:access_token');
        _config.regex.grantType = new RegExp('^(' + _config.grants.join('|') + ')$', 'i');
        
        _config.model.setExtendedGrantHandler('urn:twitter:access_token', handler);
    }
    
    this.grantHandler = function(callback) {
        return function(req, res, next) {
            new Grant(_config, req, res, function(error, responseObject, grantType) {
                callback(req, res, next, error, responseObject, grantType);
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
            } else if (req.cookies['cookie-bearer']){
                if (!req.body || !req.body.grant_type){
                    return new CookieAuthorize(_config, req, function(error) {
                        callback(req, res, next, error);
                    });
                }
            } else {
                // We do not require any authorization at this point
                // It will checked later on
                next();
            }
        }
    }
}

module.exports = OAuth;
