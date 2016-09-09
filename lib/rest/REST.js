var http = require('http');
var express = require('express');
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var formidable = require('express-formidable');
var cors = require('cors');

var changeCase = require('change-case');
var _ = require('underscore');

var names = require('../utils/names.js');
var errors = require('../utils/errors.js');
var parsing = require('../utils/parsing.js')

var requests = require('../api/requests.js');

var OAuth = require('./oauth/OAuth.js');

var RESTQueryHandler = require('./RESTQueryHandler.js');
var RESTCreateHandler = require('./RESTCreateHandler.js');
var RESTReadHandler = require('./RESTReadHandler.js');
var RESTUpdateHandler = require('./RESTUpdateHandler.js');
var RESTDeleteHandler = require('./RESTDeleteHandler.js');


function hasNotAllowedKeys(object, allowedKeys) {
    return _.difference(allowedKeys, _.keys(object)).length > 0;
}

module.exports = function(application, config) {
    var Backery = application.Backery;
    
    // Root Express application
    var server = express();
    
    // API Express application
    var api = express();
    var basePath = '/api';
    server.use(basePath, api);
    
    var oauth = new OAuth(application);
    
    var modelDefinition = application.getModelDefinition();
    
    
    var ns = config.requestContextNamespace;
    
    api.settings['x-powered-by'] = false;
    api.use(function(req, res, next) {
        req.backeryShouldRespondVerbose = req.headers['x-backery-verbosity'] == 'Verbose';
        return next();
    });
    
    api.use(cookieParser());
    api.use(bodyParser.json({
        limit: config.maxBodySize
    }));
    api.use(formidable.parse());
    
    api.use('/auth', bodyParser.urlencoded({
        extended: false
    }));
    
    // TODO: support multipart form data
    
    // CORS - for all origins
    api.use(cors());
    
    // CORS - preflight checks
    api.options('*', cors());
    
    
    var router = {
        processRequest: function(req, verbose, res, next, successCode, onSuccess, onError) {
            ns.run(function(outer) {
    			ns.set('user', req.user);
                
                application.processRequest(req).then(function(responseStruct) {
                    if (req.type != 'CustomEndpoint') {
                        var successCode;
                
                        if (!responseStruct) {
                            successCode = 204;
                        }
            
                        successCode = successCode || 200;
                        console.log('SUCCESS (%d) %j', successCode, responseStruct);
            
                        if (onSuccess) {
                            onSuccess(successCode, responseStruct);
                        } else {
                            res.status(successCode).send(responseStruct ? responseStruct.toJSON(verbose) : undefined);
                        }
                    } else {
                        var successCode = responseStruct.statusCode;
                        if (!successCode && !responseStruct) {
                            successCode = 204;
                        }
                    
                        function prepareCustomResponseData(data) {
                            if (_.isObject(data) && !_.isArray(data) && !_.isFunction(data)) {
                                if (_.isFunction(data.toStruct)) {
                                    return data.toStruct({ }).toJSON(verbose);
                                } else {
                                    return _.object(_.map(data, function(value, key) {
                                        return [key, prepareCustomResponseData(value)];
                                    }));
                                }
                            } else if (_.isArray(data)) {
                                return _.map(data, function(value) {
                                    return prepareCustomResponseData(value);
                                });
                            } else {
                                return data;
                            }
                        }
                        responseStruct.data = prepareCustomResponseData(responseStruct.data);
                    
                        successCode = successCode || 200;
                        console.log('SUCCESS (%d) %j', successCode, responseStruct.data);
                
                        if (onSuccess) {
                            onSuccess(successCode, responseStruct);
                        } else {
                            res.status(successCode).send(responseStruct.data);
                        }
                    }
                }).catch(function(error) {
                    if (onError) {
                        onError(error, res, next);
                    } else {
                        next(error);
                    }
                });
            });
        },
    
        parseJSONParameter: function(req, paramName) {
            if (req.query[paramName]) {
                if (!_.isObject(req.query[paramName]) || hasNotAllowedKeys(req.query[paramName], ['json'])) {
                    throw new errors.BackeryInvalidParametersError('Invalid parameter `' + paramName + '`', [paramName])
                }
            
                try {
                    return JSON.parse(req.query[paramName].json);
                } catch (error) {
                    throw new errors.BackeryInvalidParametersError('Failed to parse JSON for parameter `' + paramName + '`', [paramName + '.json']);
                }
            }
        },
    
        parseIntegerParameter: function(req, paramName) {
            if (req.query[paramName]) {
                var parsed = parseInt(req.query[paramName]);
                if (_.isNumber(parsed) && !_.isNaN(parsed)) {
                    return parsed;
                } else {
                    throw new errors.BackeryInvalidParametersError('Integer expected for ' + paramName, [paramName]);
                }
            }
        },
        
        parseIncludeParameter: function(req) {
            return parsing.parseInclude(req.query['include']);
        },
    
        parseWhereParameter: function(req) {
            return parsing.parseWhere(req.query['where']);
        },
    
        parseSortParameter: function(req) {
            return parsing.parseSort(req.query['sort']);
        },
        
        entityPath: function(entityDefinition, isPlural) {
            return isPlural ? names.toURLCase(entityDefinition.pluralName) : 'objects/' + entityDefinition.name;
        },
        
        toURLCase: function(path) {
            return names.toURLCase(path);
        },
        
        toCamelCase: function(path) {
            return changeCase.camelCase(path);
        }
    };
    
    // Configure API paths
    console.log('REST API endpoints:');
    
    // Authentication
    api.post('/auth', oauth.grantHandler(function(req, res, next, error, responseObject, grantType) {
        console.log('POST %s %j', req.url, { grant_type: grantType });
        
        if (error) {
            next(error);
        } else {
            if (grantType != "refresh_token") {
                responseObject = _.extend(responseObject, {
                    user: req.user.object.toJSON({ verbose: req.backeryShouldRespondVerbose })
                })
                
                console.log('SUCCESS (%d) %j', 200, responseObject.user);
            }
            res.send(responseObject);
        }
    }));
    
    console.log('  Authentication');
    console.log('    authenticate: POST ' + basePath + '/auth');
    
    
    // Sign up with password method
    var passwordAuthMethod = _.find(modelDefinition.authMethods, function(authMethod) {
        return authMethod.isPassword();
    });
    
    if (passwordAuthMethod) {
        oauth.enablePassword();
        
        // Create user and sign him up
        console.log('    sign up: POST ' + basePath + '/auth/signup');
        
        api.post('/auth/signup', function(req, res, next) {
            
            var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, req.body, undefined,
                undefined, undefined, application.Backery);
            
            router.processRequest(createRequest, req.backeryShouldRespondVerbose, res, next, 201, function(successCode, responseObject) {
                // auto-authenticate
                oauth.grantUser(req, res, createRequest.object, function(error, authResponseObject) {
                    if (!error) {
                        res.status(successCode).send(_.extend(authResponseObject, { user: responseObject.toJSON(req.backeryShouldRespondVerbose) }));
                    }
                    else {
                        res.status(successCode).send(responseObject);
                    }
                });
            }, function(error) {
                if (error.name == 'BackeryDatabaseError' && error.reason == 'BackeryFieldValueIsNotUnique') {
                    
                    if (error.details.length) {
                        error = new errors.BackeryInvalidParametersError('User with ' + error.details[0].field + ' \"' +
                            error.details[0].value + '\" already exists');
                    } else {
                        error = new errors.BackeryInvalidParametersError('User with specified credentials already exists');
                    }
                }
                
                next(error);
            });
        });
        
        api.post('/auth/recover-password', function(req, res, next) {
            if (req.body.email) {
                application.sendPasswordRecoveryEmail(req.body.email).then(function() {
                    res.status(204).send();
                }).catch(function(error) {
                    next(error);
                });
            } else {
                next(new errors.BackeryInvalidParametersError('Email is required', ['email']));
            }
        });
        
        api.post('/auth/reset-password', function(req, res, next) {
            if (!req.body.token) {
                next(new errors.BackeryInvalidParametersError('Token is required', ['token']));
                return;
            }
            
            if (!req.body.password) {
                next(new errors.BackeryInvalidParametersError('Password is required', ['password']));
                return;
            }
            
            application.resetPassword(req.body.token, req.body.password).then(function() {
                res.status(204).send();
            }).catch(function(error) {
                next(error);
            });
        });
        
        var resetPassword = express();
        server.use('/web/reset-password', resetPassword);
    
        resetPassword.set('views', config.resetPasswordAssetsPath + '/views');
        resetPassword.set('view engine', 'html');
        resetPassword.engine('html', require('hbs').__express);
    
        resetPassword.use('/css', express.static(config.resetPasswordAssetsPath + '/css'));
        resetPassword.use('/fonts', express.static(config.resetPasswordAssetsPath + '/fonts'));
        resetPassword.use('/js', express.static(config.resetPasswordAssetsPath + '/js'));
    
        resetPassword.get('/', function(req, res, next) {
            res.render('index', {
                applicationName: application.getDisplayName()
            });
        });
        
        resetPassword.get('/success', function(req, res, next) {
            res.render('success', {
                applicationName: application.getDisplayName()
            });
        });
    }
    
    // Sign up with facebook method
    var facebookAuthMethod = _.find(modelDefinition.authMethods, function(authMethod) {
        return authMethod.isFacebook();
    });
    
    if (facebookAuthMethod) {
        oauth.enableFacebook(function(req, callback) {
            if (!req.body.facebook_access_token) {
                callback(new errors.BackeryInvalidParametersError('Expected but missing: facebook_access_token'));
            } else {
                var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, {},
                    undefined, undefined, undefined, application.Backery,
                    function(createdUser) {
                        createdUser.setFacebookUserId(facebookUserId);
                    });
                var createdUser, facebookUserId;
                application.validateFacebookToken(req.body.facebook_access_token).then(function(aFacebookUserId) {
                    if (aFacebookUserId) {
                        facebookUserId = aFacebookUserId;
                    
                        return application.getModel().authUser('facebook', {
                            facebookUserId: facebookUserId
                        });
                    } else {
                        return application.Backery.Promise.reject(new errors.BackeryInvalidParametersError('Invalid facebook_access_token'));
                    }
                }).then(function(user) {
                    if (user) {
                        callback(undefined, user);
                        return application.Backery.Promise.resolve();
                    } else {
                        return application.processRequest(createRequest);
                    }
                }).then(function(responseObject) {
                    if (createRequest.object)
                        callback(undefined, createRequest.object);
                }, function(error) {
                    callback(error);
                });
            }
        });
    }
    
    // Sign up with twitter method
    var twitterAuthMethod = _.find(modelDefinition.authMethods, function(authMethod) {
        return authMethod.isTwitter();
    });
    
    if (twitterAuthMethod) {
        oauth.enableTwitter(function(req, callback) {
            if (!req.body.twitter_access_token || !req.body.twitter_access_token_secret) {
                callback(new new errors.BackeryInvalidParametersError('Expected but missing: twitter_access_token and twitter_access_token_secret'));
            } else {
                var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, {},
                    undefined, undefined, undefined, application.Backery,
                    function(createdUser) {
                        createdUser.setTwitterUserId(twitterUserId);
                    });
                var createdUser, twitterUserId;
                application.validateTwitterToken(req.body.twitter_access_token, req.body.twitter_access_token_secret).then(function(aTwitterUserId) {
                    if (aTwitterUserId) {
                        twitterUserId = aTwitterUserId;
                        return application.getModel().authUser('twitter', {
                            twitterUserId: twitterUserId
                        });
                    } else {
                        return application.Backery.Promise.reject(new errors.BackeryInvalidParametersError('Invalid twitter_access_token'));
                    }
                }).then(function(user) {
                    if (user) {
                        callback(undefined, user);
                        return application.Backery.Promise.resolve();
                    } else {
                        return application.processRequest(createRequest);
                    }
                }).then(function(responseObject) {
                    if (createRequest.object)
                        callback(undefined, createRequest.object);
                }, function(error) {
                    callback(error);
                });
            }
        });
    }
    
    // Sign up with google method
    var googleAuthMethod = _.find(modelDefinition.authMethods, function(authMethod) {
        return authMethod.isGoogle();
    });
    
    if (googleAuthMethod) {
        oauth.enableGoogle(function(req, callback) {
            if (!req.body.google_id_token) {
                callback(new new errors.BackeryInvalidParametersError('Expected but missing: google_id_token'));
            } else {
                var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, {},
                    undefined, undefined, undefined, application.Backery,
                    function(createdUser) {
                        createdUser.setGoogleUserId(googleUserId);
                    });
                var createdUser, googleUserId;
                application.validateGoogleToken(req.body.google_id_token).then(function(aGoogleUserId) {
                    if (aGoogleUserId) {
                        googleUserId = aGoogleUserId;
                        return application.getModel().authUser('google', {
                            googleUserId: googleUserId
                        });
                    } else {
                        return application.Backery.Promise.reject(new errors.BackeryInvalidParametersError('Invalid google_id_token'));
                    }
                }).then(function(user) {
                    if (user) {
                        callback(undefined, user);
                        return application.Backery.Promise.resolve();
                    } else {
                        return application.processRequest(createRequest);
                    }
                }).then(function(responseObject) {
                    if (createRequest.object)
                        callback(undefined, createRequest.object);
                }, function(error) {
                    callback(error);
                });
            }
        });
    }
    
    // Authorizes all requests, set res.user to corresponding user object
    api.use(oauth.authorizeHandler(function(req, res, next, error) {
        if (error) {
            next(error);
        } else {
            next();
        }
    }));
    
    // Data
    _.each(modelDefinition.entities, function(entityDefinition) {
        // Generate paths if there is a least 1 role that can access the object
        console.log('  %s', entityDefinition.name);
        
        // Create
        RESTCreateHandler(api, application, entityDefinition, router);
        
        // Update
        RESTUpdateHandler(api, application, entityDefinition, router);
        
        // Delete
        RESTDeleteHandler(api, application, entityDefinition, router);
        
        // Query
        RESTQueryHandler(api, application, entityDefinition, router);
        
        // Read
        RESTReadHandler(api, application, entityDefinition, router);
    });
    
    // Custom endpoints
    console.log('  _Custom');
    
    _.each(application.getCustomEndpointsList(), function(endpoint) {
        console.log('    %s %s', endpoint.method.toUpperCase(), basePath + endpoint.path);
        
        api[endpoint.method](endpoint.path, function(req, res, next) {
            var params = _.extend(req.query, req.params);
            
            console.log('%s %s (custom endpoint, user: %s) params: %j, body: %j',
                endpoint.method.toUpperCase(), req.path, req.user ? req.user.id : 'none', params, req.body);
            
            router.processRequest(new requests.CustomEndpointRequest(endpoint.method, endpoint.path, {
                path: req.path,
                params: params,
                body: req.body,
                files: req.files,
                verbose: req.backeryShouldRespondVerbose
            }, req.user ? req.user.object : undefined, application.Backery), req.backeryShouldRespondVerbose, res, next);
        });
    });
    
    // Sub-applications
    console.log('Applications');
    _.each(application.getSubApplications(), function(sub, mountpath) {
        console.log('  - ' + mountpath);
        server.use(mountpath, sub);
    });
    
    
    // Error handler
    api.use(function errorHandler(error, req, res, next) {
        if (res.headersSent) {
            return next(error);
        }
        
        console.error('ERROR:', error.stack || error);
        
        var status = error.status || 500;
        var code = error.code || 'InternalServerError';
        var message = error.hasMessageForBackery ? error.message : 'Server failed to process the request';
        
        res.status(status).send({
            code: code,
            message: message,
            debug: process.env.NODE_ENV != 'production' ? error.stack : undefined
        });
    });
    
    // 404
    api.use(function(req, res, next) {
        res.status(404).send({
            code: 'NotFound',
            message: 'Cannot ' + req.method + ' ' + req.path
        });
    });

    // Listen
    return new application.Backery.Promise(function(resolve, reject) {
        var httpServer = http.createServer(server).listen(config.port, function(error) {
            if (!error) {
                resolve({
                    address: httpServer.address()
                });
            } else {
                reject(error);
            }
        });
    });
};
