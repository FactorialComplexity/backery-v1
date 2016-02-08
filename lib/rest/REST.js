var restify = require('restify');
var changeCase = require('change-case');
var OAuthServer = require('oauth2-server');
var _ = require('underscore');

var names = require('../utils/names.js');
var errors = require('../utils/errors.js');
var requests = require('../api/requests.js')
var parsing = require('../api/parsing.js')

var OAuthModel = require('./OAuthModel.js')


function hasNotAllowedKeys(object, allowedKeys) {
    return _.difference(allowedKeys, _.keys(object)).length > 0;
}

module.exports = function(application, config) {
    
    // Create server
    var server = restify.createServer({
        name: application.getName()
    });
    
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
    
    server.oauth = OAuthServer({
        model: new OAuthModel(application),
        grants: ['password', 'refresh_token'],
        debug: true
    });
    
    
    // Configure API paths
    console.log('REST API endpoints:');
    
    // Authentication
    server.post(basePath + '/auth', function(req, res, next) {
        res.jsonp = function(json) {
            res.send(json);
        };
        return next();
    }, server.oauth.grant());
    console.log('  Authentication');
    console.log('    authenticate: POST ' + basePath + '/auth');
    
    
    server.post(basePath + '/auth/signup', function(req, res, next) {
        // TODO: simple sign up
    });
    
    
    // Data
    _.each(modelDefinition.entities, function(entityDefinition) {
        
        function respondError(error, res, next) {
            if (error.name)
                console.log('ERROR (%s) %s', error.name, error.message);
            
            if (error.name == 'BackerAccessDeniedError') {
                restifyError = new restify.errors.ForbiddenError(error.message);
            } else if (error.name == 'BackerNotFoundError') {
                restifyError = new restify.errors.NotFoundError(error.message);
            } else if (error.name == 'BackerInvalidParametersError') {
                restifyError = new restify.errors.UnprocessableEntityError(error.message);
            } else {
                console.error('SERVER ERROR %s', error.stack);
                
                restifyError = new restify.errors.InternalServerError('Server failed to process the request');
            }
            
            return next(restifyError);
        }
        
        function processRequest(req, res, next, successCode) {
            application.processRequest(req).then(function(responseObject) {
                if (!responseObject) {
                    successCode = 204;
                }
                
                successCode = successCode || 200;
                console.log('SUCCESS (%d) %j', successCode, responseObject);
                
                res.send(successCode, responseObject);
                next();
            }, function(error) {
                respondError(error, res, next)
            });
        }
        
        function parseJSONParameter(req, paramName) {
            if (req.query[paramName]) {
                if (!_.isObject(req.query[paramName]) || hasNotAllowedKeys(req.query[paramName], ['json'])) {
                    throw new errors.BackerInvalidParametersError('Invalid parameter `' + paramName + '`', [paramName])
                }
                
                try {
                    return JSON.parse(req.query[paramName].json);
                } catch (error) {
                    throw new errors.BackerInvalidParametersError('Failed to parse JSON for parameter `' + paramName + '`', [paramName + '.json']);
                }
            }
        }
        
        function parseIntegerParameter(req, paramName) {
            if (req.query[paramName]) {
                var parsed = parseInt(req.query[paramName]);
                if (_.isNumber(parsed) && !_.isNaN(parsed)) {
                    return parsed;
                } else {
                    throw new errors.BackerInvalidParametersError('Integer expected for ' + paramName, [paramName]);
                }
            }
        }
        
        function parseIncludeParameter(req) {
            return parsing.parseInclude(req.query['include']);
        }
        
        function parseWhereParameter(req) {
            return parsing.parseWhere(req.query['where']);
        }
        
        // Generate paths if there is a least 1 role that can access the object
        console.log('  %s', entityDefinition.name);
        
        // Create
        if (entityDefinition.access.allow['create'].length) {
            server.post(basePath + '/' +  names.toURLCase(entityDefinition.pluralName), function(req, res, next) {
                console.log('POST %s %j', req.url, req.body);
                processRequest(new requests.CreateRequest(application.Backer[entityDefinition.name], req.body, application.Backer),
                    res, next, 201);
            });
            
            console.log('    create: POST ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName));
            
            // TODO: Create with relation
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
                
                processRequest(new requests.ReadRequest(application.Backer[entityDefinition.name], req.params.objectId, include, application.Backer), res, next);
            });
            
            console.log('    read: GET ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
            
            // TODO: Read separate fields
        }
        
        // Update
        if (entityDefinition.access.allow['update'].length) {
            server.put(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('PUT %s %j', req.url, req.body);
                processRequest(new requests.UpdateRequest(application.Backer[entityDefinition.name], req.params.objectId, req.body, application.Backer), res, next);
            });
            
            console.log('    update: PUT ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
            
            // TODO: Update separate fields
        }
        
        // Delete
        if (entityDefinition.access.allow['delete'].length) {
            server.del(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('DELETE %s', req.url);
                
                processRequest(new requests.DeleteRequest(application.Backer[entityDefinition.name], req.params.objectId, application.Backer), res, next);
            });
            
            console.log('    delete: DELETE ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
        }
        
        // Query
        if (entityDefinition.access.allow['query'].length) {
            var supportedOperations = ['find', 'count', 'find-and-count'];
            
            var queryHandler = function(req, res, next) {
                console.log('GET %s', req.url);
                
                try {
                    var queryData = { };
                    queryData.where = parseJSONParameter(req, 'where');
                    queryData.sort = parseJSONParameter(req, 'sort');
                    queryData.include = parseIncludeParameter(req);
                    queryData.offset = parseIntegerParameter(req, 'offset');
                    queryData.limit = parseIntegerParameter(req, 'limit');
                    
                    console.log('  query: %s', JSON.stringify(queryData));
                } catch (error) {
                    return respondError(error, res, next);
                }
                
                if (req.params.operation && !_.contains(supportedOperations, req.params.operation)) {
                    return respondError(new errors.BackerInvalidParametersError('Unsupported query operation `' + req.params.operation + '`'), res, next);
                }
                
                processRequest(new requests.QueryRequest(application.Backer[entityDefinition.name], changeCase.camelCase(req.params.operation || 'find'),
                    queryData, application.Backer), res, next);
            };
            
            var queryBasePath = basePath + '/' +  names.toURLCase(entityDefinition.pluralName);
            server.get(queryBasePath, queryHandler);
            server.get(queryBasePath + '/:operation', queryHandler);
            
            console.log('    query: GET ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName));
            _.each(supportedOperations, function(operation) {
                console.log('    query: GET ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/' + operation);
            });
            
            // TODO: Query relation
        }
    });
    
    // Listen
    return new application.Backer.Promise(function(resolve, reject) {
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
