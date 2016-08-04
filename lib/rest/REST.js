var restify = require('restify');
var changeCase = require('change-case');
var _ = require('underscore');
var cookieParser = require('restify-cookies');

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
    
    // Create server
    var server = restify.createServer({
        name: application.getName()
    });
    var oauth = new OAuth(application);
    
    var modelDefinition = application.getModelDefinition();
    var basePath = '/api';
    
    var ns = config.requestContextNamespace;
    
    server.pre(function(req, res, next) {
        if (/^\/api/.test(req.url) && req.body && !req.is('application/json'))
            return next(new restify.errors.NotAcceptableError('JSON data is expected. Content-Type header should be set to application/json.'));
        
        return next();
    });
    
    server.pre(function(req, res, next) {
        req.backeryShouldRespondVerbose = req.headers['x-backery-verbosity'] == 'Verbose';
        return next();
    });
    
    server.pre(cookieParser.parse);
    server.pre(restify.bodyParser({
        maxBodySize: config.maxBodySize,
        mapParams: false
    }));
    
    server.use(restify.queryParser({ mapParams: false }));
    
    server.use(restify.CORS());
    server.use(restify.fullResponse());
    
    // Lets try and fix CORS support
    // By default the restify middleware doesn't do much unless you instruct
    // it to allow the correct headers.
    //
    // See issues:
    // https://github.com/mcavage/node-restify/issues/284 (closed)
    // https://github.com/mcavage/node-restify/issues/664 (unresolved)
    //
    // What it boils down to is that each client framework uses different headers
    // and you have to enable the ones by hand that you may need.
    // The authorization one is key for our authentication strategy
    //
    restify.CORS.ALLOW_HEADERS.push("authorization");
    restify.CORS.ALLOW_HEADERS.push("withcredentials");
    restify.CORS.ALLOW_HEADERS.push("x-requested-with");
    restify.CORS.ALLOW_HEADERS.push("x-forwarded-for");
    restify.CORS.ALLOW_HEADERS.push("x-real-ip");
    restify.CORS.ALLOW_HEADERS.push("x-customheader");
    restify.CORS.ALLOW_HEADERS.push("user-agent");
    restify.CORS.ALLOW_HEADERS.push("keep-alive");
    restify.CORS.ALLOW_HEADERS.push("host");
    restify.CORS.ALLOW_HEADERS.push("accept");
    restify.CORS.ALLOW_HEADERS.push("connection");
    restify.CORS.ALLOW_HEADERS.push("upgrade");
    restify.CORS.ALLOW_HEADERS.push("content-type");
    restify.CORS.ALLOW_HEADERS.push("dnt"); // Do not track
    restify.CORS.ALLOW_HEADERS.push("if-modified-since");
    restify.CORS.ALLOW_HEADERS.push("cache-control");

    // Manually implement the method not allowed handler to fix failing preflights
    //
    server.on("MethodNotAllowed", function(request, response) {
        if (request.method.toUpperCase() === "OPTIONS") {
            response.header("Access-Control-Allow-Credentials", true);
            response.header("Access-Control-Allow-Headers", restify.CORS.ALLOW_HEADERS.join( ", " ));
            response.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
            response.header("Access-Control-Allow-Origin", request.headers.origin);
            response.header("Access-Control-Max-Age", 0);
            response.header("Content-type", "text/plain charset=UTF-8");
            response.header("Content-length", 0);

            response.send(204);
        }
        else {
            response.send(new restify.MethodNotAllowedError());
        }
    });
    
    var router = {
        respondError: function(error, res, next) {
            if (error.name)
                console.log('ERROR (%s) %s', error.name, error.message);
        
            function customizedErrorOptions(inputError, suggestedRestifyError) {
                var ret = {
                    statusCode: inputError.status,
                    message: inputError.message
                };
                
                return ret;
            }
        
            if (error.name == 'BackeryNotFoundError') {
                restifyError = new restify.errors.NotFoundError(customizedErrorOptions(error));
            } else if (error.name == 'BackeryInvalidParametersError') {
                restifyError = new restify.errors.UnprocessableEntityError(customizedErrorOptions(error));
            } else if (error.name == 'BackeryConsistencyError') {
                restifyError = new restify.errors.UnprocessableEntityError(customizedErrorOptions(error));
            } else if (error.name == 'BackeryBadRequestError') {
                restifyError = new restify.errors.BadRequestError(customizedErrorOptions(error));
            } else if (error.name == 'BackeryUnauthorizedError') {
                restifyError = new restify.errors.UnauthorizedError(customizedErrorOptions(error));
            } else {
                if (error.status && error.code) {
                    restifyError = new restify.errors.InternalServerError(customizedErrorOptions(error));
                } else {
                    console.error('SERVER ERROR %s', error.stack);
                    
                    restifyError = new restify.errors.InternalServerError('Server failed to process the request');
                }
            }
        
            if (error.code) {
                restifyError.body.code = error.code;
            }
            
            restifyError.body.debug = error.stack;
        
            _.each(error.headers, function(value, key) {
                res.header(key, value);
            });
            res.send(restifyError);
        },
    
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
                            res.send(successCode, responseStruct ? responseStruct.toJSON(verbose) : undefined);
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
                            res.send(successCode, responseStruct.data);
                        }
                    }
            
                    next();
                }).catch(function(error) {
                    if (onError) {
                        onError(error, res, next);
                    } else {
                        router.respondError(error, res, next);
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
    server.post(basePath + '/auth', oauth.grantHandler(function(req, res, next, error, responseObject, grantType) {
        if (error) {
            router.respondError(error, res, next);
        } else {
            if (grantType != "refresh_token") {
                responseObject = _.extend(responseObject, {
                    user: req.user.object.toJSON({ verbose: req.backeryShouldRespondVerbose })
                })
            }
            res.send(responseObject);
            next();
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
        
        server.post(basePath + '/auth/signup', function(req, res, next) {
            
            var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, req.body, undefined,
                undefined, undefined, application.Backery);
            
            router.processRequest(createRequest, req.backeryShouldRespondVerbose, res, next, 201, function(successCode, responseObject) {
                // auto-authenticate
                oauth.grantUser(req, res, createRequest.object, function(error, authResponseObject) {
                    if (!error)
                        res.send(successCode, _.extend(authResponseObject, { user: responseObject.toJSON(req.backeryShouldRespondVerbose) }));
                    else
                        res.send(successCode, responseObject);
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
                
                router.respondError(error, res, next);
            });
        });
        
        server.post(basePath + '/auth/recover-password', function(req, res, next) {
            if (req.body.email) {
                application.sendPasswordRecoveryEmail(req.body.email).then(function() {
                    res.send(204);
                }).catch(function(error) {
                    router.respondError(error, res, next);
                });
            } else {
                router.respondError(new errors.BackeryInvalidParametersError('Email is required', ['email']), res, next);
            }
        });
        
        server.post(basePath + '/auth/reset-password', function(req, res, next) {
            if (!req.body.token) {
                router.respondError(new errors.BackeryInvalidParametersError('Token is required', ['token']), res, next);
                return;
            }
            
            if (!req.body.password) {
                router.respondError(new errors.BackeryInvalidParametersError('Password is required', ['password']), res, next);
                return;
            }
            
            application.resetPassword(req.body.token, req.body.password).then(function() {
                res.send(204);
            }).catch(function(error) {
                router.respondError(error, res, next);
            });
        });
        
        server.get('/web/reset-password', function(req, res, next) {
            res.redirect('/web/reset-password/?token=' + req.query.token, next);
        });
        
        server.get(/\/web\/reset-password\/?.*/, restify.serveStatic({
            directory: __dirname + '/static',
            default: 'index.html'
        }));
    }
    
    // Sign up with facebook method
    var facebookAuthMethod = _.find(modelDefinition.authMethods, function(authMethod) {
        return authMethod.isFacebook();
    });
    
    if (facebookAuthMethod) {
        oauth.enableFacebook(function(req, callback) {
            if (!req.body.facebook_access_token) {
                callback(new new errors.BackeryInvalidParametersError('Expected but missing: facebook_access_token'));
            } else {
                var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, {},
                    undefined, undefined, undefined, application.Backery,
                    function(createdUser) {
                        createdUser.setFacebookUserId(facebookUserId);
                    });
                var createdUser, facebookUserId;
                application.validateFacebookToken(req.body.facebook_access_token).then(function(aFacebookUserId) {
                    facebookUserId = aFacebookUserId;
                    return application.getModel().authUser('facebook', {
                        facebookUserId: facebookUserId
                    });
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
    
    // Sign up with facebook method
    var twitterAuthMethod = _.find(modelDefinition.authMethods, function(authMethod) {
        return authMethod.isTwitter();
    });
    
    if (twitterAuthMethod) {
        oauth.enableTwitter(function(req, callback) {
            if (!req.body.twitter_access_token) {
                callback(new new errors.BackeryInvalidParametersError('Expected but missing: twitter_access_token'));
            } else {
                var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, {},
                    undefined, undefined, undefined, application.Backery,
                    function(createdUser) {
                        createdUser.setTwitterUserId(twitterUserId);
                    });
                var createdUser, twitterUserId;
                application.validateTwitterToken(req.body.twitter_access_token, req.body.twitter_access_token_secret).then(function(atwitterUserId) {
                    twitterUserId = atwitterUserId;
                    return application.getModel().authUser('twitter', {
                        twitterUserId: twitterUserId
                    });
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
    server.pre(oauth.authorizeHandler(function(req, res, next, error) {
        if (error) {
            router.respondError(error, res, next);
        } else {
            next();
        }
    }));
    
    // Data
    _.each(modelDefinition.entities, function(entityDefinition) {
        // Generate paths if there is a least 1 role that can access the object
        console.log('  %s', entityDefinition.name);
        
        // Create
        RESTCreateHandler(server, application, basePath, entityDefinition, router);
        
        // Update
        RESTUpdateHandler(server, application, basePath, entityDefinition, router);
        
        // Delete
        RESTDeleteHandler(server, application, basePath, entityDefinition, router);
        
        // Query
        RESTQueryHandler(server, application, basePath, entityDefinition, router);
        
        // Read
        RESTReadHandler(server, application, basePath, entityDefinition, router);
    });
    
    // Custom endpoints
    console.log('  _Custom');
    
    _.each(application.getCustomEndpointsList(), function(endpoint) {
        console.log('    %s %s', endpoint.method.toUpperCase(), basePath + endpoint.path);
        
        server[endpoint.method](basePath + endpoint.path, function(req, res, next) {
            var params = _.extend(req.query, req.params);
            
            console.log('%s %s (custom endpoint, user: %s) params: %j, body: %j',
                endpoint.method.toUpperCase(), req.path(), req.user ? req.user.id : 'none', params, req.body);
            
            router.processRequest(new requests.CustomEndpointRequest(endpoint.method, endpoint.path, {
                path: req.path(),
                params: params,
                body: req.body,
                files: req.files,
                verbose: req.backeryShouldRespondVerbose
            }, req.user ? req.user.object : undefined, application.Backery), req.backeryShouldRespondVerbose, res, next);
        });
    });
    
    server.on('uncaughtException', function(req, res, route, error) {
        console.error(error.stack);
        res.send(new restify.errors.InternalServerError('Server failed to process the request'));
    });

    server.get(/\/cms\/?.*/, restify.serveStatic({
        directory: __dirname + '/../../../extension/',
        default: 'index.html'
    }));
    // Listen
    return new application.Backery.Promise(function(resolve, reject) {
        server.listen(config.port, function(error) {
            if (!error) {
                resolve({
                    address: server.address()
                });
            } else {
                reject(error);
            }
        });
    })
};
