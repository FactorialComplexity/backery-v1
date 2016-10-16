var _ = require('lodash');

var errors = require('../utils/errors.js');

var parsing = require('../utils/parsing.js')

module.exports = function(api, application, router) {
    api.post('/batch', function(req, res, next) {
        console.log('POST %s (user: %s)', req.url, req.user ? req.user.objectId() : 'none');
        
        if (!req.is('multipart/form-data')) {
            return next(new errors.BackeryInvalidParametersError('Batch requests should be Content-Type: multipart/form-data'));
        }
        
        function prepareRequest(requestId, json, fileUpload) {
            var supportedParameters = {
                'create': [ 'include' ],
                'update': [ 'include', 'objectId' ],
                'read': [ 'include', 'objectId' ],
                'query': [
                    'where', 'sort', 'include', 'offset', 'limit',
                    'objectId', 'relation', 'operation'
                ],
                'delete': [ 'objectId' ]
            };
            
            var requiredParameters = {
                'create': [ ],
                'update': [ 'objectId' ],
                'read': [ 'objectId' ],
                'query': [ 'operation' ],
                'delete': [ 'objectId' ]
            };
            
            if (_.isUndefined(supportedParameters[json.type])) {
                throw new errors.BackeryInvalidParametersError("Invalid type '" + json.type +
                    "' for request '" + requestId + "'");
            }
            
            var entityDefinition = application.getModelDefinition().entities[json.entity];
            if (!entityDefinition) {
                throw new errors.BackeryInvalidParametersError("Unknown entity '" + json.entity +
                    "' for request '" + requestId + "'");
            }
            
            var unsupportedParameters = _.difference(_.keys(json.params), supportedParameters[json.type]);
            if (unsupportedParameters.length) {
                throw new errors.BackeryInvalidParametersError("Unsupported parameters '" + unsupportedParameters.join(', ') +
                    "' for request '" + requestId + "' (type: " + json.type + ")");
            }
            
            // Process and check params
            var params = {};
            _.each(json.params, function(param, name) {
                if (name == 'include') {
                    params[name] = router.parseIncludeParameter({ query: { include: param }});
                } else if (name == 'where') {
                    params[name] = router.parseWhereParameter({ query: { where: param }});
                } else if (name == 'sort') {
                    params[name] = router.parseSortParameter({ query: { sort: param }});
                } else if (name == 'offset') {
                    params[name] = router.parseIntegerParameter({ query: { offset: param }}, name);
                } else if (name == 'limit') {
                    params[name] = router.parseIntegerParameter({ query: { limit: param }}, name);
                } else if (name == 'objectId') {
                    if (_.isString(param)) {
                        params[name] = param;
                    } else {
                        throw new errors.BackeryInvalidParametersError("Invalid objectId '" + param +
                            "' for request '" + requestId + "' (type: " + json.type + ")");
                    }
                } else if (name == 'relation') {
                    if (_.isString(param) && entityDefinition.fields[param].type.isRelationMany()) {
                        params[name] = param;
                    } else {
                        throw new errors.BackeryInvalidParametersError("Invalid relation '" + param +
                            "' for request '" + requestId + "' (type: " + json.type + ")");
                    }
                } else if (name == 'operation') {
                    if (param == 'find' || param == 'count' || param == 'find-and-count' || !param) {
                        params[name] = router.toCamelCase(param || 'find');
                    }
                }
            });
            
            var missingParameters = _.difference(requiredParameters[json.type], _.keys(params));
            if (missingParameters.length) {
                throw new errors.BackeryInvalidParametersError("Missing required parameters '" + missingParameters.join(', ') +
                    "' for request '" + requestId + "' (type: " + json.type + ")");
            }
            
            console.log(' %s: %j', requestId, {
                type: json.type,
                entity: entityDefinition.name,
                params: params,
                body: json.body,
                file: fileUpload
            });
            
            return {
                id: requestId,
                type: json.type,
                entityDefinition: entityDefinition,
                params: params,
                body: json.body,
                file: fileUpload
            };
        }
        
        var sortedKeys = _.keys(req.body).sort();
        var requests = [];
        try {
            _.each(sortedKeys, function(key) {
                if (key.match(/\.json$/)) {
                    json = JSON.parse(req.body[key]);
                    var requestId = key.substring(0, key.length - '.json'.length)
                    
                    if (_.isUndefined(json))
                        throw new errors.BackeryInvalidParametersError("Couldn't parse JSON in '" + key  +"'");
                    
                    var fileUpload = req.body[requestId + '.body'];
                    if (!fileUpload || !fileUpload.path) {
                        return next(new errors.BackeryInvalidParametersError("File data is expected in '" + requestId + '.body' + "'"));
                    }
                    
                    requests.push(prepareRequest(requestId, json, fileUpload ? {
                        path: fileUpload.path,
                        name: fileUpload.name,
                        contentType: fileUpload.type,
                        size: fileUpload.size
                    } : undefined));
                    
                } else if (!key.match(/\.body$/)) {
                    var requestId = key;
                    
                    json = JSON.parse(req.body[key]);
                    if (_.isUndefined(json))
                        throw new errors.BackeryInvalidParametersError("Couldn't parse JSON in '" + key  +"'");
                
                    requests.push(prepareRequest(requestId, json));
                }
            });
        } catch(error) {
            return next(error);
        }
        
        function resolveCrossReferencesInBody(body, entityDefinition, createdObjects) {
            var resolved = { };
            function resolveValue(value) {
                if (value.match(/^\@/)) {
                    var requestId = value.substring(1);
                    var resolvedObject = createdObjects[requestId];
                    if (!resolvedObject) {
                        throw new errors.BackeryInvalidParametersError("Request '" + requestId  +
                            "' was cross-referenced before being resolved.");
                    }
                    return resolvedObject;
                } else {
                    return value;
                }
            }
            
            _.each(body, function(value, key) {
                if (value && entityDefinition.fields[key] && entityDefinition.fields[key].type.isRelationOne()) {
                    resolved[key] = resolveValue(value);
                } else if (value && entityDefinition.fields[key] && entityDefinition.fields[key].type.isRelationMany()) {
                    if (_.isArray(value)) {
                        resolved[key] = _.map(value, function(v) {
                            return resolveValue(v);
                        });
                    } else if (value.__type === 'RelationOperation') {
                        resolved[key] = _.pickBy({
                            __type: 'RelationOperation',
                            set: value.set ? _.map(value.set, function(v) {
                                return resolveValue(v);
                            }) : undefined,
                            add: value.add ? _.map(value.add, function(v) {
                                return resolveValue(v);
                            }) : undefined,
                            remove: value.remove ? _.map(value.remove, function(v) {
                                return resolveValue(v);
                            }) : undefined
                        }, _.negate(_.isUndefined));
                    }
                } else {
                    resolved[key] = value;
                }
            });
            
            console.log(body, resolved);
            return resolved;
        }
        
        router.runInContext(req.user, function() {
            var createdObjects = { };
            
            var lastRequest;
            application.Backery.Promise.mapSeries(requests, function(request) {
                lastRequest = request;
                
                var applicationRequest;
                if (request.type == 'create') {
                    applicationRequest = new application.Request.CreateOrUpdate(application.Backery.Model[request.entityDefinition.name],
                        undefined, resolveCrossReferencesInBody(request.body, request.entityDefinition, createdObjects),
                        request.file, request.params.include, req.user, application.Backery);
                } else if (request.type == 'update') {
                    applicationRequest = new application.Request.CreateOrUpdate(application.Backery.Model[request.entityDefinition.name],
                        request.params.objectId, resolveCrossReferencesInBody(request.body, request.entityDefinition, createdObjects),
                        undefined, request.params.include, req.user, application.Backery);
                } else if (request.type == 'read') {
                    applicationRequest = new application.Request.Read(application.Backery.Model[request.entityDefinition.name], request.params.objectId,
                        request.params.include, req.user, application.Backery);
                } else if (request.type == 'query') {
                    var entity = application.Backery.Model[request.entityDefinition.name];
                    var query = !request.params.relation ? entity.query() :
                        entity.load(request.params.objectId).relation(request.params.relation).query();
                
                    try {
                        if (queryData.where)
                            query.where(request.params.where);
        
                        if (queryData.sort)
                            query.sort(request.params.sort);

                        query.include(request.params.include,
                            (request.params.operation != 'count' && !request.params.include || request.params.include));

                        if (!_.isUndefined(request.params.offset))
                            query.offset(request.params.offset);
            
                        if (!_.isUndefined(request.params.limit))
                            query.limit(request.params.limit);
                    } catch (error) {
                        return next(error);
                    }
                    
                    applicationRequest = new application.Request.Query(query, request.params.operation,
                        req.user, application.Backery);
                } else if (request.type == 'delete') {
                    applicationRequest = new application.Request.Delete(application.Backery.Model[request.entityDefinition.name],
                        request.params.objectId, req.user, application.Backery)
                }
                
                return application.processRequest(applicationRequest).then(function(responseStruct) {
                    if (request.type == 'create') {
                        createdObjects[request.id] = responseStruct.objectId;
                    }
                    
                    return {
                        requestId: request.id,
                        responseStruct: responseStruct
                    };
                });
            }).then(function(results) {
                res.status(200).send(_.map(results, function(result) {
                    return {
                        requestId: result.requestId,
                        response: result.responseStruct ?
                            result.responseStruct.toJSON(req.backeryShouldRespondVerbose) :
                            null
                    };
                }));
            }).catch(function(error) {
                error.requestId = lastRequest.id;
                return next(error);
            });
        });
    });
    
    console.log('    batch: POST ' + api.mountpath + '/batch');
}
