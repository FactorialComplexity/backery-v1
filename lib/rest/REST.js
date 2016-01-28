var restify = require('restify');
var _ = require('underscore');

var names = require('../utils/names.js');
var errors = require('../utils/errors.js');
var requests = require('../api/requests.js');

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
    
    server.use(restify.queryParser());
    server.use(restify.bodyParser({
        maxBodySize: config.maxBodySize
    }));
    
    // Configure API paths
    console.log('REST API endpoints:');
    
    _.each(modelDefinition.entities, function(entityDefinition) {
        
        function processRequest(req, res, next, successCode) {
            worker.process(req).then(function(responseObject) {
                if (!responseObject) {
                    successCode = 204;
                }
                
                console.log('SUCCESS (%d) %j', successCode, responseObject);
                
                res.send(successCode ? successCode : 200, responseObject);
                next();
            }, function(error) {
                if (error.name)
                    console.log('ERROR (%s) %s', error.name, error.message);
                
                if (error.name == 'BackerAccessDeniedError') {
                    restifyError = new restify.errors.ForbiddenError(error.message);
                } else if (error.name == 'BackerNotFoundError') {
                    restifyError = new restify.errors.NotFoundError(error.message);
                } else {
                    console.error('SERVER ERROR %s', error.stack);
                    
                    restifyError = new restify.errors.InternalServerError('Server failed to process the request');
                }
                
                return next(restifyError);
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
                processRequest(new requests.ReadRequest(worker.Backer[entityDefinition.name], req.params.objectId, worker.Backer), res, next);
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
            server.get(basePath + '/' +  names.toURLCase(entityDefinition.pluralName), function(req, res, next) {
                processRequest(new requests.QueryRequest(worker.Backer[entityDefinition.name], req.body), res, next);
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
