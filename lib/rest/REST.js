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

var OAuth = require('./oauth/OAuth.js');

var RESTQueryHandler = require('./RESTQueryHandler.js');
var RESTCreateHandler = require('./RESTCreateHandler.js');
var RESTReadHandler = require('./RESTReadHandler.js');
var RESTUpdateHandler = require('./RESTUpdateHandler.js');
var RESTDeleteHandler = require('./RESTDeleteHandler.js');
var RESTBatchHandler = require('./RESTBatchHandler.js');


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
    
    var oauth = new OAuth(application.getAuthentication());
    
    var modelDefinition = application.getModelDefinition();
    
    
    var ns = config.requestContextNamespace;
    
    api.settings['x-powered-by'] = false;
    api.use(function(req, res, next) {
        req.backeryShouldRespondVerbose = req.headers['x-backery-verbosity'] == 'Verbose';
        return next();
    });
    
    // CORS - for all origins
    api.use(cors());
    
    api.use(cookieParser());
    api.use(bodyParser.json({
        limit: config.maxBodySize
    }));
    api.use(formidable.parse({
        maxFieldsSize: config.maxFieldsSize
    }));
    
    api.use('/auth', bodyParser.urlencoded({
        extended: false
    }));
    
    // TODO: support multipart form data
    
    // CORS - preflight checks
    api.options('*', cors());
    
    
    var router = {
        runInContext: function(user, run) {
            ns.run(function(outer) {
                ns.set('user', user);
                
                run();
            });
        },
        
        processRequest: function(request, verbose, req, res, next, successCode, onSuccess, onError) {
            ns.run(function(outer) {
    			ns.set('user', request.user);
                
                application.processRequest(request, { clientId: req.clientId }).then(function(responseStruct) {
                    if (request.type != 'CustomEndpoint') {
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
                        if (!successCode && !responseStruct.data) {
                            successCode = 204;
                        }
                    
                        function prepareCustomResponseData(data) {
                            if (_.isObject(data) && !_.isArray(data) && !_.isFunction(data)) {
                                if (_.isFunction(data.toStruct)) {
                                    return data.toStruct({ user: request.user }).toJSON(verbose);
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
    
    
    // Status
    api.get('/', function status(req, res, next) {
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(_.extend(application.getStatusObject(), {
            schema: basePath + '/schema'
        }), null, 2));
    });
    
    
    // Schema
    api.get('/schema', function schema(req, res, next) {
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(application.getSchemaJSONObject(), null, 2));
    });
    
    console.log(' Schema');
    console.log('    GET ' + basePath + '/schema');
    
    
    // Authentication
    api.post('/auth', oauth.grant());
    
    console.log('  Authentication');
    console.log('    authenticate: POST ' + basePath + '/auth');
    
    
    // Sign up with password method
    var passwordAuthMethod = _.find(modelDefinition.authMethods, function(authMethod) {
        return authMethod.isPassword();
    });
    
    if (passwordAuthMethod) {
        // Create user and sign him up
        console.log('    sign up: POST ' + basePath + '/auth/signup');
        
        api.post('/auth/signup', oauth.validateClient(true), function(req, res, next) {
            var createRequest = new application.Request.CreateOrUpdate(application.Backery.Model.User, undefined, req.body, undefined,
                undefined, undefined, application.Backery, undefined, { isMaster: true });
            
            router.processRequest(createRequest, req.backeryShouldRespondVerbose, req, res, next, 201, function(successCode, responseObject) {
                // auto-authenticate
                oauth.grantUser(req, createRequest.object).then(function(authResponseObject) {
                    res.status(successCode).send(authResponseObject);
                }).catch(function(error) {
                    next(error);
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
        resetPassword.use('/images', express.static(config.resetPasswordAssetsPath + '/images'));
    
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
    
    // Authenticate all requests, set res.user to corresponding user object
    api.use(oauth.authenticate());
    
    // Batch requests
    RESTBatchHandler(api, application, router);
    
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
                endpoint.method.toUpperCase(), req.path, req.user ? req.user.objectId() : 'none', params, req.body);
            
            router.processRequest(new application.Request.CustomEndpoint(endpoint.method, endpoint.path, {
                path: req.path,
                params: params,
                body: req.body,
                files: req.files,
                verbose: req.backeryShouldRespondVerbose
            }, req.user, application.Backery), req.backeryShouldRespondVerbose, req, res, next);
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
        
        if (/^maxFieldsSize exceeded/.test(error.message)) { // formidable error
            error = new errors.BackeryInvalidParametersError(error.message);
        }
        
        var status = error.status || 500;
        var code = error.code || 'InternalServerError';
        var message = error.hasMessageForBackery ? error.message : 'Server failed to process the request';
        
        res.status(status).send({
            code: code,
            message: message,
            requestId: error.requestId,
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
