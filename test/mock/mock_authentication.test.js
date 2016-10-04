var proxyquire =  require('proxyquire');
var _ =  require('lodash');

var Promise = require('../../lib/promise/BackeryPromise.js');
var errors = require('../../lib/utils/errors.js');
var cls = require('continuation-local-storage').getNamespace('io.backery.request.context');

var mock_BackeryObject = require('./mock_BackeryObject.js');

/**
 * A set of mocks specifically for "authentication" test suite.
 * Token-related methods in Database are fully mocked here.
 */
module.exports = function(config, schema) {
    var mock = { };
    
    var accessTokens = { };
    var refreshTokens = { };
    
    var Authentication = proxyquire('../../lib/authentication/Authentication.js', require('./mock_TokenChecker.js'));
    
    var ModelSchema = require('../../lib/model/definition/ModelDefinition.js');
    schema = new ModelSchema(schema);
    
    var Backery = {
        Promise: Promise(cls)
    };
    
    Backery.Model = {
        User: {
            create: function(data) {
                var object = new BackeryObject(data);
                
                object.save = function() {
                    users[object.objectId()] = object;
                    return Backery.Promise.resolve(object);
                }
                
                return object;
            },
            
            query: function() {
                return new function() {
                    var self = this;
                    var email;
                
                    this.where = function(key, value) {
                        email = value;
                        return self;
                    }
                
                    this.findOne = function() {
                        var data = _.find(mock.users, function(user) {  
                            return user.email == email;
                        });
                        
                        if (data) {
                            var object = new mock_BackeryObject(_.pickBy(data, function(key) { return key != 'password'; }));
                            object.isPasswordCorrect = function(password) {
                                return password == data.password;
                            };
                            return Backery.Promise.resolve(object);
                        } else {
                            return Backery.Promise.resolve();
                        }
                    }
                };
            }
        }
    };
    
    var application = {
        Backery: Backery,
        Request: {
            CreateOrUpdate: function() { }
        },
        getModel: function() {
            return {
                getDefinition: function() {
                    return schema;
                },
                
                getAccessToken: function(accessToken) {
                    var t = accessTokens[accessToken];
                    if (t) {
                        return Backery.Promise.resolve({
                            token: t.token,
                            expires: t.expires,
                            user: t.user
                        });
                    } else {
                        return Backery.Promise.resolve();
                    }
                },
                
                saveAccessToken: function(accessToken, clientId, expires, user) {
                    accessTokens[accessToken] = {
                        token: accessToken,
                        clientId: clientId,
                        expires: expires,
                        user: user
                    };
                    
                    return Backery.Promise.resolve();
                },
                
                getRefreshToken: function(refreshToken) {
                    var t = refreshTokens[refreshToken];
                    if (t) {
                        return Backery.Promise.resolve({
                            token: t.token,
                            expires: t.expires,
                            clientId: t.clientId,
                            user: t.user,
                        
                            update: function(newExpires, newValue) {
                                t.expires = newExpires;
                                t.token = newValue;
                                
                                return Backery.Promise.resolve();
                            }
                        });
                    } else {
                        return Backery.Promise.resolve();
                    }
                },
                
                saveRefreshToken: function(refreshToken, clientId, expires, user) {
                    refreshTokens[refreshToken] = {
                        token: refreshToken,
                        clientId: clientId,
                        expires: expires,
                        user: user
                    };
                    
                    return Backery.Promise.resolve();
                },
                
                findUserWithThirdPartyServiceUserId: function(media, userId) {
                    if (media == 'facebook' || media == 'twitter' || media == 'google') {
                        if (userId == ('existingUserId_' + media)) {
                            return Backery.Promise.resolve(new mock_BackeryObject({
                                id: 'validUserId'
                            }));
                        } else {
                            return Backery.Promise.resolve();
                        }
                    } else {
                        return Backery.Promise.reject(new errors.BackeryDatabaseError(new Error('invalid column')));
                    }
                }
            };
        },
        
        processRequest: function(request) {
            request.object = new mock_BackeryObject({
                id: 'validUserId'
            });
            return Backery.Promise.resolve();
        }
    };
    
    var nconf = require('nconf');
    nconf.defaults(config);
    
    mock.Backery = Backery;
    mock.auth = new Authentication(application, nconf);
    
    return mock;
};
