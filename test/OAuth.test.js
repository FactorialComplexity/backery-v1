var proxyquire =  require('proxyquire');
var sinon = require('sinon');
var should = require('should');
require('should-sinon');

var nconf = require('nconf');
var _ = require('lodash');

var initApplication = proxyquire('../lib/application.js', {
    './authentication/Authentication.js': proxyquire('../lib/authentication/Authentication.js', require('./mock/mock_TokenChecker.js'))
});

var OAuth = require('../lib/rest/oauth/OAuth.js');

describe('OAuth', function() {
    var application, oauth;
    
    before(function() {
        var config = {
            database: {
                uri: 'sqlite://:memory:',
                options: {
                    shouldLogQueries: false
                }
            },
            oauth2: {
                clients: {
                    client1: 'secret1',
                    client2: 'secret2'
                },
                tokensLifetime: {
                    accessToken: 3600,
                    refreshToken: 1209600
                }
            }
        };

        var schema = {
            "authMethods": [
                { "method": "facebook" },
                { "method": "twitter" },
                { "method": "google" },
                { "method": "password", "loginFields": [ "email" ], "passwordRecoveryEmailField": "email" }
            ],

            "entities": [
                {
                    "name": "User",
                    "fields": [
                        { "name": "email", "type": { "name": "String", "limit": 40 } }
                    ]
                },
            ]
        };
        
        return initApplication(nconf.defaults(config), schema).then(function(anApplication) {
            nconf.stores.defaults.readOnly = false;
            
            application = anApplication;
            oauth = new OAuth(application.getAuthentication());
        });
    });
    
    describe('#grant()', function() {
        var grant, req, res;
        beforeEach(function() {
            grant = oauth.grant();
            
            req = {
                header: function(key) {
                    if (key == 'Authorization') {
                        return 'Basic ' + (new Buffer('client1:secret1').toString('base64'));
                    }
                },
                is: function(contentType) { return contentType == 'application/x-www-form-urlencoded'; },
                body: {
                },
                method: 'POST'
            };
            
            res = {
                set: sinon.spy(),
                send: sinon.spy()
            };
        });
        
        it('should fail with BadRequestError when content-type is not application/x-www-form-urlencoded', function() {
            req.is = function(contentType) { return contentType == 'application/json'; },
            
            grant(req, res, function(error) {
                res.send.should.not.be.called();
                should(error.code).be.exactly('BadRequestError');
            });
        });
        
        it('should fail with UnauthorizedError when Authorization header is not provided', function() {
            req.header = function(key) { };
            
            grant(req, res, function(error) {
                res.send.should.not.be.called();
                should(error.code).be.exactly('UnauthorizedError');
                res.set.should.be.calledWith('WWW-Authenticate', 'Basic realm="Service"');
            });
        });
        
        it('should fail with UnauthorizedError when invalid Authorization header was provided', function() {
            req.header = function(key) {
                if (key == 'Authorization') {
                    return '3123sa';
                }
            }
            
            grant(req, res, function(error) {
                res.send.should.not.be.called();
                should(error.code).be.exactly('UnauthorizedError');
                res.set.should.be.calledWith('WWW-Authenticate', 'Basic realm="Service"');
            });
        });
        
        it('should fail with UnauthorizedError when invalid client credentials were provided', function() {
            req.header = function(key) {
                if (key == 'Authorization') {
                    return 'Basic ' + (new Buffer('client1:invalidSecret').toString('base64'));
                }
            }
            
            grant(req, res, function(error) {
                res.send.should.not.be.called();
                should(error.code).be.exactly('UnauthorizedError');
                res.set.should.be.calledWith('WWW-Authenticate', 'Basic realm="Service"');
            });
        });
        
        it('should fail with InvalidParametersError when grant_type is missing', function() {
            grant(req, res, function(error) {
                res.send.should.not.be.called();
                should(error.code).be.exactly('InvalidParametersError');
            });
        });
        
        describe('[grant_type=password]', function() {
            beforeEach(function() {
                return application.Backery.Model.User.create({
                    email: 'test@example.com',
                    password: '123'
                }).save();
            });
        
            afterEach(function() {
                return application.Backery.Model.User.query()
                    .where('email', 'test@example.com').findOne().then(function(user) {
                
                    return user.destroy();
                });
            });
        
            it('should return proper results for grant_type=password', function(done) {
                req.body = {
                    grant_type: 'password',
                    username: 'email:test@example.com',
                    password: '123'
                };
            
                res.send = function(data) {
                    should(data.token_type).be.exactly('bearer');
                    should(data.access_token).be.a.String();
                    should(data.access_token).be.ok();
                    should(data.expires_in).be.a.Number();
                    should(data.expires_in).be.ok();
                    should(data.refresh_token).be.a.String();
                    should(data.refresh_token).be.ok();
                    should(data.user).be.ok();
                    should(data.user.email).be.exactly('test@example.com');
                
                    done();
                }
            
                grant(req, res, function(error) {
                    done(error || new Error('next() was called'));
                });
            });
        
            it('should fail with InvalidCredentialsError when invalid password was specified', function(done) {
                req.body = {
                    grant_type: 'password',
                    username: 'email:test@example.com',
                    password: 'invalid'
                };
                
                res.send = function(data) {
                    done(new Error('res.send() should not be called'));
                };
            
                grant(req, res, function(error) {
                    should(error.code).be.exactly('InvalidCredentialsError');
                    done();
                });
            });
            
            it('should fail with InvalidCredentialsError when invalid value for login field was specified', function(done) {
                req.body = {
                    grant_type: 'password',
                    username: 'email:test1@example.com',
                    password: '123'
                };
                
                res.send = function(data) {
                    done(new Error('res.send() should not be called'));
                };
            
                grant(req, res, function(error) {
                    should(error.code).be.exactly('InvalidCredentialsError');
                    done();
                });
            });
        });
        
        _.each([
            {
                grant_type: 'urn:facebook:access_token',
                bindMethodName: 'setFacebookUserId',
                existingUserId: 'existingUserId_facebook',
                params: {
                    facebook_access_token: {
                        validForNotExistingUser: 'validFacebookTokenForNotExistingUser',
                        validForExistingUser: 'validFacebookTokenForExistingUser'
                    }
                }
            },
            {
                grant_type: 'urn:twitter:access_token',
                bindMethodName: 'setTwitterUserId',
                existingUserId: 'existingUserId_twitter',
                params: {
                    twitter_access_token: {
                        validForNotExistingUser: 'validTwitterTokenForNotExistingUser',
                        validForExistingUser: 'validTwitterTokenForExistingUser'
                    },
                    twitter_access_token_secret: {
                        validForNotExistingUser: 'validTwitterTokenSecret',
                        validForExistingUser: 'validTwitterTokenSecret'
                    }
                }
            },
            {
                grant_type: 'urn:google:access_token',
                bindMethodName: 'setGoogleUserId',
                existingUserId: 'existingUserId_google',
                params: {
                    google_id_token: {
                        validForNotExistingUser: 'validGoogleTokenForNotExistingUser',
                        validForExistingUser: 'validGoogleTokenForExistingUser'
                    }
                }
            }
        ], function(thirdParty) {
            describe('[grant_type=' + thirdParty.grant_type + ']', function() {
                it('should return proper data when valid token data is provided', function(done) {
                    req.body = {
                        grant_type: thirdParty.grant_type
                    };
                    
                    _.each(thirdParty.params, function(value, key) {
                        req.body[key] = value.validForNotExistingUser;
                    });
                    
                    res.send = function(data) {
                        should(data.token_type).be.exactly('bearer');
                        should(data.access_token).be.a.String();
                        should(data.access_token).be.ok();
                        should(data.expires_in).be.a.Number();
                        should(data.expires_in).be.ok();
                        should(data.refresh_token).be.a.String();
                        should(data.refresh_token).be.ok();
                        should(data.user).be.ok();
                        should(data.user.id).be.a.String();
                    
                        done();
                    }
                
                    grant(req, res, function(error) {
                        done(error || new Error('next() was called'));
                    });
                });
            
                it('should return proper data when valid token data is provided and user already exists', function(done) {
                    var user = application.Backery.Model.User.create();
                    user[thirdParty.bindMethodName](thirdParty.existingUserId);
                    user.save().then(function() {
                        req.body = {
                            grant_type: thirdParty.grant_type
                        };
                        
                        _.each(thirdParty.params, function(value, key) {
                            req.body[key] = value.validForExistingUser;
                        });
            
                        res.send = function(data) {
                            should(data.token_type).be.exactly('bearer');
                            should(data.access_token).be.a.String();
                            should(data.access_token).be.ok();
                            should(data.expires_in).be.a.Number();
                            should(data.expires_in).be.ok();
                            should(data.refresh_token).be.a.String();
                            should(data.refresh_token).be.ok();
                            should(data.user).be.ok();
                            should(data.user.id).be.exactly(user.objectId());
                    
                            done();
                        }
                
                        grant(req, res, function(error) {
                            done(error || new Error('next() was called'));
                        });
                    });
                });
            
                it('should return UnauthorizedError when invalid token data is provided', function(done) {
                    req.body = {
                        grant_type: thirdParty.grant_type
                    };
                    
                    _.each(thirdParty.params, function(value, key) {
                        req.body[key] = 'invalid';
                    });
        
                    res.send = function(data) {
                        done(new Error('res.send() should not be called'));
                    };
            
                    grant(req, res, function(error) {
                        should(error.code).be.exactly('UnauthorizedError');
                        done();
                    });
                });
            });
        });
        
        describe('[grant_type=refresh_token]', function() {
            var refreshToken;
            
            beforeEach(function() {
                return application.Backery.Model.User.create({
                    email: 'test@example.com',
                    password: '123'
                }).save().then(function(user) {
                    return application.getAuthentication().createRefreshToken('client1', user).then(function(aRefreshToken) {
                        refreshToken = aRefreshToken;
                    });
                });
            });
        
            afterEach(function() {
                return application.Backery.Model.User.query()
                    .where('email', 'test@example.com').findOne().then(function(user) {
                
                    return user.destroy();
                });
            });
            
            it('should return proper data for valid refresh_token', function(done) {
                req.body = {
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                };
            
                res.send = function(data) {
                    should(data.token_type).be.exactly('bearer');
                    should(data.access_token).be.a.String();
                    should(data.access_token).be.ok();
                    should(data.expires_in).be.a.Number();
                    should(data.expires_in).be.ok();
                    should(data.refresh_token).be.a.String();
                    should(data.refresh_token).be.ok();
                    should(data.user).not.be.ok();
                    
                    done();
                }
                
                grant(req, res, function(error) {
                    done(error || new Error('next() was called'));
                });
            });
            
            it('should fail with InvalidTokenError when invalid refresh_token was supplied', function(done) {
                req.body = {
                    grant_type: 'refresh_token',
                    refresh_token: 'Invalid'
                };
            
                grant(req, res, function(error) {
                    should(error.code).be.exactly('InvalidTokenError');
                    done();
                });
            });
            
            it('should fail with TokenExpiredError when expired refresh_token was supplied', function(done) {
                application.Backery.Model.User.create({
                    email: 'test2@example.com',
                    password: '123'
                }).save().then(function(user) {
                    nconf.set('oauth2:tokensLifetime:refreshToken', 1);
                    return application.getAuthentication().createRefreshToken('client1', user);
                }).delay(1200).then(function(aRefreshToken) {
                    req.body = {
                        grant_type: 'refresh_token',
                        refresh_token: aRefreshToken
                    };
                    
                    res.send = function(data) {
                        done(new Error('res.send() should not be called'));
                    };
            
                    grant(req, res, function(error) {
                        should(error.code).be.exactly('TokenExpiredError');
                        done();
                    });
                });
            });
        });
    });
    
    describe('#authenticate()', function() {
        var user, accessToken;
        before(function() {
            return application.Backery.Model.User.create({
                email: 'test@example.com',
                password: '123'
            }).save().then(function(aUser) {
                user = aUser;
                return application.getAuthentication().createAccessToken('client1', user).then(function(anAccessToken) {
                    accessToken = anAccessToken.token;
                });
            });
        });
        
        after(function() {
            return application.Backery.Model.User.query()
                .where('email', 'test@example.com').findOne().then(function(user) {
                
                return user.destroy();
            });
        });
        
        var authenticate, req, res;
        beforeEach(function() {
            authenticate = oauth.authenticate();
            
            req = {
                header: function(key) {
                },
                is: function(contentType) { return contentType == 'application/json'; },
                body: {
                },
                query: {
                },
                method: 'POST'
            };
            
            res = {
                set: sinon.spy(),
                send: sinon.spy()
            };
        });
        
        it('should set proper req.user value if valid access is provided', function(done) {
            req.header = function(key) {
                if (key == 'Authorization') {
                    return 'Bearer ' + accessToken;
                }
            }
            
            authenticate(req, res, function(error) {
                res.send.should.not.be.called();
                should(error).not.be.ok();
                should(req.user).be.ok();
                req.user.objectId().should.be.exactly(user.objectId());
                done();
            });
        });
        
        it('should pass the request through without modifying req.user, if no authorization header is present', function(done) {
            authenticate(req, res, function(error) {
                res.send.should.not.be.called();
                should(error).not.be.ok();
                should(req.user).not.be.ok();
                done();
            });
        });
        
        it('should fail with TokenExpiredError if specified token is invalid', function(done) {
            req.header = function(key) {
                if (key == 'Authorization') {
                    return 'Bearer invalid';
                }
            }
            
            authenticate(req, res, function(error) {
                should(error).be.ok();
                should(error.code).be.exactly('TokenExpiredError');
                done();
            });
        });
    });
});
