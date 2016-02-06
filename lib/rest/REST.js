var restify = require('restify');
var _ = require('underscore');

var names = require('../utils/names.js');
var errors = require('../utils/errors.js');
var requests = require('../api/requests.js');
var changeCase = require('change-case');

function hasNotAllowedKeys(object, allowedKeys) {
    return _.difference(allowedKeys, _.keys(object)).length > 0;
}

module.exports = function(config, applicationName, modelDefinition, worker, callback) {
    // Create server
    var server = restify.createServer({
        name: applicationName
    });
    
    var basePath = '/api';
    
    server.pre(function(req, res, next) {
        if (/^\/api/.test(req.url) && req.body && !req.is('application/json'))
            return next(new restify.errors.NotAcceptableError('JSON data is expected. Content-Type header should be set to application/json.'));
        
        return next();
    });
    
    server.use(restify.queryParser({ mapParams: false }));
    server.use(restify.bodyParser({
        maxBodySize: config.maxBodySize
    }));
    
    // Configure API paths
    console.log('REST API endpoints:');
    
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
            worker.process(req).then(function(responseObject) {
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
            var includeString = req.query['include'];
            return _.map(includeString.split(','), function(fieldInclude) {
                var match = /^([a-zA-Z][a-zA-Z0-9\_]*)(\(([0-9]+)\;([0-9]+)\))?$/.exec(fieldInclude);
                if (match) {
                    if (!_.isUndefined(match[3])) {
                        return _.object([[ match[1], { offset: parseInt(match[3]), limit: parseInt(match[4]) } ]]);
                    } else {
                        return match[1];
                    }
                } else {
                    throw new errors.BackerInvalidParametersError('Invalid include string');
                }
            });
        }
        
        // Generate paths if there is a least 1 role that can access the object
        console.log('  %s', entityDefinition.name);
        
        // Create
        if (entityDefinition.access.allow['create'].length) {
            server.post(basePath + '/' +  names.toURLCase(entityDefinition.pluralName), function(req, res, next) {
                console.log('POST %s %j', req.url, req.body);
                processRequest(new requests.CreateRequest(worker.Backer[entityDefinition.name], req.body, worker.Backer),
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
                
                processRequest(new requests.ReadRequest(worker.Backer[entityDefinition.name], req.params.objectId, include, worker.Backer), res, next);
            });
            
            console.log('    read: GET ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
            
            // TODO: Read separate fields
        }
        
        // Update
        if (entityDefinition.access.allow['update'].length) {
            server.put(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('PUT %s %j', req.url, req.body);
                processRequest(new requests.UpdateRequest(worker.Backer[entityDefinition.name], req.params.objectId, req.body, worker.Backer), res, next);
            });
            
            console.log('    update: PUT ' + basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId');
            
            // TODO: Update separate fields
        }
        
        // Delete
        if (entityDefinition.access.allow['delete'].length) {
            server.del(basePath + '/' +  names.toURLCase(entityDefinition.pluralName) + '/:objectId', function(req, res, next) {
                console.log('DELETE %s', req.url);
                
                processRequest(new requests.DeleteRequest(worker.Backer[entityDefinition.name], req.params.objectId, worker.Backer), res, next);
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
                
                processRequest(new requests.QueryRequest(worker.Backer[entityDefinition.name], changeCase.camelCase(req.params.operation || 'find'),
                    queryData, worker.Backer), res, next);
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
    return new worker.Backer.Promise(function(resolve, reject) {
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
