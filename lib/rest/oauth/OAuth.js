var errors = require('../../utils/errors.js');
var grant = require('./Grant.js');
var authenticate = require('./Authenticate.js');
var _ = require('lodash');

var OAuth = function(auth) {
    var Backery = auth.Backery;
    
    var _config = {
        regex: {
            clientId: /^[a-z0-9\-_]{3,40}$/i
        },
        extendedGrantHandlers: { }
    };
    
    var self = this;
    
    if (auth.isAuthenticationMethodSupported('password')) {
        _config.grants.push('password');
    }
    
    function authenticateUserHandler(type, requiredParameters) {
        return function(req) {
            var params = { };
            try {
                _.each(requiredParameters, function(param) {
                    if (!req.body[param]) {
                        throw new errors.BackeryInvalidParametersError('Expected but missing parameter "' + param + '"');
                    } else {
                        params[param] = req.body[param];
                    }
                });
            } catch (error) {
                return Backery.Promise.reject(error);
            }
            
            return auth.authenticateUser(type, params);
        };
    }
    
    if (auth.isAuthenticationMethodSupported('facebook')) {
        _config.grants.push('urn:facebook:access_token');
        _config.extendedGrantHandlers['urn:facebook:access_token'] = authenticateUserHandler('facebook',
            ['facebook_access_token']);
    } else if (auth.isAuthenticationMethodSupported('twitter')) {
        _config.grants.push('urn:twitter:access_token');
        _config.extendedGrantHandlers['urn:twitter:access_token'] = authenticateUserHandler('twitter',
            ['twitter_access_token', 'twitter_access_token_secret']);
    } else if (auth.isAuthenticationMethodSupported('google')) {
        _config.grants.push('urn:google:access_token');
        _config.extendedGrantHandlers['urn:google:access_token'] = authenticateUserHandler('google',
            ['google_id_token']);
    }
    
    var Grant = grant(auth, _config, Backery); 
    this.grant = function() {
        return function(req, res, next) {
            var g = new Grant(req);
            g.process().then(function(responseData) {
                res.send(responseData);
            }).catch(function(error) {
                next(error);
            });
        }
    }
    
    this.validateClient = function() {
        return function(req, res, next) {
            var g = new Grant(req);
            g.validateClient().then(function() {
                next();
            }).catch(function(error) {
                next(error);
            });
        }
    }
    
    this.grantUser = function(req, user) {
        var g = new Grant(req);
        return g.process(user);
    }
    
    var Authenticate = authenticate(auth, _config, Backery); 
    this.authenticate = function() {
        return function(req, res, next) {
            if (req.header('Authorization') && req.header('Authorization').indexOf('Bearer') == 0) {
                var a = new Authenticate(req);
                a.process().then(function() {
                    next();
                }).catch(function(error) {
                    next(error);
                });
            } else {
                // No access token provided, request was authenticated
                next();
            }
        }
    }
}

module.exports = OAuth;
