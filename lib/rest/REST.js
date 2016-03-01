var restify = require('restify');
var changeCase = require('change-case');
var _ = require('underscore');

var names = require('../utils/names.js');
var errors = require('../utils/errors.js');
var parsing = require('../utils/parsing.js')

var requests = require('../api/requests.js');

var OAuth = require('./oauth/OAuth.js');


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
    
    server.pre(function(req, res, next) {
        if (/^\/api/.test(req.url) && req.body && !req.is('application/json'))
            return next(new restify.errors.NotAcceptableError('JSON data is expected. Content-Type header should be set to application/json.'));
        
        return next();
    });
    
    server.pre(function(req, res, next) {
        req.backeryShouldRespondVerbose = req.headers['x-backery-verbosity'] == 'Verbose';
        return next();
    });
    
    server.use(restify.queryParser({ mapParams: false }));
    server.use(restify.bodyParser({
        maxBodySize: config.maxBodySize,
        mapParams: false
    }));
    
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
    
    
    function respondError(error, res, next) {
        if (error.name)
            console.log('ERROR (%s) %s', error.name, error.message);
        
        if (error.name == 'BackerAccessDeniedError') {
            restifyError = new restify.errors.ForbiddenError(error.message);
        } else if (error.name == 'BackeryNotFoundError') {
            restifyError = new restify.errors.NotFoundError(error.message);
        } else if (error.name == 'BackeryInvalidParametersError') {
            restifyError = new restify.errors.UnprocessableEntityError(error.message);
        } else if (error.name == 'BackeryBadRequestError') {
            restifyError = new restify.errors.BadRequestError(error.message);
        } else if (error.name == 'BackeryUnauthorizedError') {
            restifyError = new restify.errors.UnauthorizedError(error.message);
        } else {
            console.error('SERVER ERROR %s', error.stack);
            
            restifyError = new restify.errors.InternalServerError('Server failed to process the request');
        }
        
        _.each(error.headers, function(value, key) {
            res.header(key, value);
        });
        res.send(restifyError);
    }
    
    function processRequest(req, verbose, res, next, successCode, onSuccess, onError) {
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
                    res.send(successCode, responseStruct.toJSON(verbose));
                }
            } else {
                var successCode = responseStruct.statusCode;
                if (!successCode && !responseStruct) {
                    successCode = 204;
                }
                
                successCode = successCode || 200;
                console.log('SUCCESS (%d) %j', successCode, responseStruct.data);
                
                if (onSuccess) {
                    onSuccess(successCode, responseStruct);
                } else {
                    res.send(successCode, responseStruct.data);
                }
            }
            
            next();
        }, function(error) {
            if (onError) {
                onError(error, res, next);
            } else {
                respondError(error, res, next);
            }
        });
    }
    
    function parseJSONParameter(req, paramName) {
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
    }
    
    function parseIntegerParameter(req, paramName) {
        if (req.query[paramName]) {
            var parsed = parseInt(req.query[paramName]);
            if (_.isNumber(parsed) && !_.isNaN(parsed)) {
                return parsed;
            } else {
                throw new errors.BackeryInvalidParametersError('Integer expected for ' + paramName, [paramName]);
            }
        }
    }
    
    function parseIncludeParameter(req) {
        return parsing.parseInclude(req.query['include']);
    }
    
    function parseWhereParameter(req) {
        return parsing.parseWhere(req.query['where']);
    }
    
    function parseSortParameter(req) {
        return parsing.parseSort(req.query['sort']);
    }
    
    // Configure API paths
    console.log('REST API endpoints:');
    
    // Authentication
    server.post(basePath + '/auth', oauth.grantHandler(function(req, res, next, error, responseObject) {
        if (error) {
            respondError(error, res, next);
        } else {
            res.send(_.extend(responseObject, {
                user: req.user.object.toJSON(req.user.object)
            }));
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
            
            var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, req.body, undefined, undefined, application.Backery);
            var createdUser = createRequest.getObject();
            
            if (!createRequest.getValidationError()) {
                try {
                    createdUser.validatePasswordAuthentication();
                } catch (error) {
                    createRequest.setValidationError(error);
                }
            }
            
            processRequest(createRequest, req.backeryShouldRespondVerbose, res, next, 201, function(successCode, responseObject) {
                // auto-authenticate
                oauth.grantUser(req, res, createdUser, function(error, authResponseObject) {
                    if (!error)
                        res.send(successCode, _.extend(authResponseObject, { user: responseObject }));
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
                
                respondError(error, res, next);
            });
        });
        
        server.post(basePath + '/auth/recover-password', function(req, res, next) {
            // TODO: implement
            if (req.body.email)
                res.send(204);
            else
                respondError(new errors.BackeryInvalidParametersError('Email is required', ['email']), res, next);
        });
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
                        var createRequest = new requests.CreateOrUpdateRequest(application.Backery.Model.User, undefined, {},
                            undefined, application.Backery);
                        
                        createdUser = createRequest.getObject();
                        createdUser.setFacebookUserId(facebookUserId);
                        
                        return application.processRequest(createRequest);
                    }
                }).then(function(responseObject) {
                    if (createdUser)
                        callback(undefined, createdUser);
                }, function(error) {
                    callback(error);
                });
            }
        });
    }
    
    // Authorizes all requests, set res.user to corresponding user object
    server.pre(oauth.authorizeHandler(function(req, res, next, error) {
        if (error) {
            respondError(error, res, next);
        } else {
            next();
        }
    }));
    
    // Data
    _.each(modelDefinition.entities, function(entityDefinition) {
        // Generate paths if there is a least 1 role that can access the object
        console.log('  %s', entityDefinition.name);
        
        // Create
        if (entityDefinition.access.allow['create'].length) {
            server.post(basePath + '/' +  names.toURLCase(entityDefinition.pluralName), function(req, res, next) {
                console.log('POST %s %j (user: %s)', req.url, req.body, req.user ? req.user.id : 'none');
                
                var include;
                try {
                    var include = parseIncludeParameter(req);
                    if (include)
                        console.log('  include: %j', include);
                } catch (error) {
                    return respondError(error, res, next);
                }
                
                processRequest(new requests.CreateOrUpdateRequest(application.Backery.Model[entityDefinition.name], undefined,
                    req.body, include, req.user, application.Backery), req.backeryShouldRespondVerbose, res, next, 201);
            });
            
            console.log('    create: POST ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName));
            
            // TODO: Create with relation
        }
        
        // Update
        if (entityDefinition.access.allow['update'].length) {
            server.put(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('PUT %s %j (user: %s)', req.url, req.body, req.user ? req.user.id : 'none');
                
                var include;
                try {
                    var include = parseIncludeParameter(req);
                    if (include)
                        console.log('  include: %j', include);
                } catch (error) {
                    return respondError(error, res, next);
                }
                
                processRequest(new requests.CreateOrUpdateRequest(application.Backery.Model[entityDefinition.name], req.params.objectId, req.body,
                    include, req.user, application.Backery), req.backeryShouldRespondVerbose, res, next);
            });
            
            console.log('    update: PUT ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
            
            // TODO: Update separate fields
        }
        
        // Delete
        if (entityDefinition.access.allow['delete'].length) {
            server.del(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('DELETE %s (user: %s)', req.url, req.user ? req.user.id : 'none');
                
                processRequest(new requests.DeleteRequest(application.Backery.Model[entityDefinition.name], req.params.objectId, req.user,
                    application.Backery), req.backeryShouldRespondVerbose, res, next);
            });
            
            console.log('    delete: DELETE ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
        }
        
        // Query
        if (entityDefinition.access.allow['query'].length) {
            var supportedOperations = ['find', 'count', 'find-and-count'];
            
            var queryHandler = function(operation, relationField) {
                return function(req, res, next) {
                    console.log('GET %s (user: %s)', req.url, req.user ? req.user.id : 'none');
                
                    try {
                        var queryData = { };
                        queryData.where = parseWhereParameter(req, 'where');
                        queryData.sort = parseSortParameter(req, 'sort');
                        queryData.include = parseIncludeParameter(req);
                        queryData.offset = parseIntegerParameter(req, 'offset');
                        queryData.limit = parseIntegerParameter(req, 'limit');
                    
                        console.log('  query: %s', JSON.stringify(queryData));
                    } catch (error) {
                        return respondError(error, res, next);
                    }
                
                    if (req.params.operation && !_.contains(supportedOperations, operation)) {
                        return respondError(new errors.BackeryInvalidParametersError('Unsupported query operation `' + operation + '`'), res, next);
                    }
                    
                    var entity = application.Backery.Model[entityDefinition.name];
                    var query = !relationField ? entity.query() :
                        entity.ref(req.params.objectId).relation(relationField.name).query();
                    
                    try {
                        if (queryData.where)
                            query.where(queryData.where);
            
                        if (queryData.sort)
                            query.sort(queryData.sort);
            
                        if (queryData.include)
                            query.include(queryData.include);
            
                        if (!_.isUndefined(queryData.offset))
                            query.offset(queryData.offset);
                
                        if (!_.isUndefined(queryData.limit))
                            query.limit(queryData.limit);
                    } catch (error) {
                        return respondError(error, res, next);
                    }
                    
                    processRequest(new requests.QueryRequest(query, changeCase.camelCase(operation || 'find'), req.user,
                        application.Backery), req.backeryShouldRespondVerbose, res, next);
                };
            }
            
            var queryBasePath = basePath + '/' +  names.toURLCase(entityDefinition.pluralName);
            server.get(queryBasePath, queryHandler('find'));
            console.log('    query: GET ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName));
            
            _.each(supportedOperations, function(operation) {
                server.get(queryBasePath + '/' + operation, queryHandler(operation));
                console.log('    query: GET ' + queryBasePath + '/' + operation);
            });
            
            _.each(entityDefinition.fields, function(field) {
                if (field.type.isRelation()) {
                    var path = queryBasePath + '/:objectId/' + names.toURLCase(field.name);
                    
                    server.get(path, queryHandler('find', field));
                    console.log('    query: GET ' + path);
                    
                    _.each(supportedOperations, function(operation) {
                        server.get(path + '/' + operation, queryHandler(operation, field));
                        console.log('    query: GET ' + path + '/' + operation);
                    });
                }
            });
            
            // TODO: Query relation
        }
        
        // Read
        if (entityDefinition.access.allow['read'].length) {
            server.get(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('GET %s (user: %s)', req.url, req.user ? req.user.id : 'none');
                
                var include;
                try {
                    var include = parseIncludeParameter(req);
                    if (include)
                        console.log('  include: %j', include);
                } catch (error) {
                    return respondError(error, res, next);
                }
                
                processRequest(new requests.ReadRequest(application.Backery.Model[entityDefinition.name], req.params.objectId, include,
                    req.user, application.Backery), req.backeryShouldRespondVerbose, res, next);
            });
            
            console.log('    read: GET ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
            
            // TODO: Read separate fields
        }
    });
    
    // Custom endpoints
    _.each(application.getCustomEndpointsList(), function(endpoint) {
        server[endpoint.method](basePath + endpoint.path, function(req, res, next) {
            console.log('%s %s (custom endpoint, user: %s) params: %j, body: %j',
                endpoint.method.toUpperCase(), req.path(), req.user ? req.user.id : 'none', req.params, req.body);
            
            processRequest(new requests.CustomEndpointRequest(endpoint.method, endpoint.path, {
                path: req.path(),
                params: req.params,
                body: req.body,
                files: req.files,
                verbose: req.backeryShouldRespondVerbose
            }, req.user, application.Backery), req.backeryShouldRespondVerbose, res, next);
        });
    });
    
    server.on('uncaughtException', function(req, res, route, error) {
        console.error(error.stack);
        res.send(new restify.errors.InternalServerError('Server failed to process the request'));
    });
    
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
