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
    
    server.use(restify.queryParser({ mapParams: false }));
    server.use(restify.bodyParser({
        maxBodySize: config.maxBodySize,
        mapParams: false
    }));
    
    server.use(restify.CORS());
    server.use(restify.fullResponse());
    
    
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
    
    function processRequest(req, res, next, successCode, onSuccess, onError) {
        application.processRequest(req).then(function(responseObject) {
            if (!responseObject) {
                successCode = 204;
            }
            
            successCode = successCode || 200;
            console.log('SUCCESS (%d) %j', successCode, responseObject);
            
            if (onSuccess) {
                onSuccess(successCode, responseObject);
            } else {
                res.send(successCode, responseObject);
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
    server.post(basePath + '/auth', oauth.auth(function(error, res, next) {
        if (error) {
            respondError(error, res, next);
        } else {
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
        // Create user and sign him up
        console.log('    sign up: POST ' + basePath + '/auth/signup');
        
        server.post(basePath + '/auth/signup', function(req, res, next) {
            
            var createRequest = new requests.CreateRequest(application.Backery.Model.User, req.body, application.Backery);
            var createdUser = createRequest.getObject();
            
            if (!createRequest.getValidationError()) {
                try {
                    createdUser.validatePasswordAuthentication();
                } catch (error) {
                    createRequest.setValidationError(error);
                }
            }
            
            processRequest(createRequest, res, next, 201, function(successCode, responseObject) {
                // TODO: auto-authenticate
                res.send(successCode, responseObject);
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
    }
    
    // Data
    _.each(modelDefinition.entities, function(entityDefinition) {
        // Generate paths if there is a least 1 role that can access the object
        console.log('  %s', entityDefinition.name);
        
        // Create
        if (entityDefinition.access.allow['create'].length) {
            server.post(basePath + '/' +  names.toURLCase(entityDefinition.pluralName), function(req, res, next) {
                console.log('POST %s %j', req.url, req.body);
                processRequest(new requests.CreateRequest(application.Backery.Model[entityDefinition.name], req.body, application.Backery),
                    res, next, 201);
            });
            
            console.log('    create: POST ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName));
            
            // TODO: Create with relation
        }
        
        // Update
        if (entityDefinition.access.allow['update'].length) {
            server.put(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('PUT %s %j', req.url, req.body);
                processRequest(new requests.UpdateRequest(application.Backery.Model[entityDefinition.name], req.params.objectId, req.body, application.Backery), res, next);
            });
            
            console.log('    update: PUT ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
            
            // TODO: Update separate fields
        }
        
        // Delete
        if (entityDefinition.access.allow['delete'].length) {
            server.del(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('DELETE %s', req.url);
                
                processRequest(new requests.DeleteRequest(application.Backery.Model[entityDefinition.name], req.params.objectId, application.Backery), res, next);
            });
            
            console.log('    delete: DELETE ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
        }
        
        // Query
        if (entityDefinition.access.allow['query'].length) {
            var supportedOperations = ['find', 'count', 'find-and-count'];
            
            var queryHandler = function(operation) {
                return function(req, res, next) {
                    console.log('GET %s', req.url);
                
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
                
                    processRequest(new requests.QueryRequest(application.Backery.Model[entityDefinition.name], changeCase.camelCase(operation || 'find'),
                        queryData, application.Backery), res, next);
                };
            }
            
            var queryBasePath = basePath + '/' +  names.toURLCase(entityDefinition.pluralName);
            server.get(queryBasePath, queryHandler('find'));
            
            console.log('    query: GET ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName));
            _.each(supportedOperations, function(operation) {
                server.get(queryBasePath + '/' + operation, queryHandler(operation));
                console.log('    query: GET ' + queryBasePath + '/' + operation);
            });
            
            // TODO: Query relation
        }
        
        // Read
        if (entityDefinition.access.allow['read'].length) {
            server.get(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('GET %s', req.url);
                
                try {
                    var include = parseIncludeParameter(req);
                    if (include)
                        console.log('  include: %j', include);
                } catch (error) {
                    return respondError(error, res, next);
                }
                
                processRequest(new requests.ReadRequest(application.Backery.Model[entityDefinition.name], req.params.objectId, include, application.Backery), res, next);
            });
            
            console.log('    read: GET ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
            
            // TODO: Read separate fields
        }
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
