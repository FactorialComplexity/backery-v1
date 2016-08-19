var _ = require('underscore');

var errors = require('../utils/errors.js');
var requests = require('../api/requests.js');

var parsing = require('../utils/parsing.js')


module.exports = function(api, application, entityDefinition, router) {
    if (entityDefinition.access.allow['query'].length) {
        _.each([true, false], function(isPlural) {
            var supportedOperations = ['find', 'count', 'find-and-count'];
        
            var queryHandler = function(operation, relationField) {
                return function(req, res, next) {
                    console.log('GET %s (user: %s)', req.url, req.user ? req.user.id : 'none');
            
                    try {
                        var queryData = { };
                        queryData.where = router.parseWhereParameter(req, 'where');
                        queryData.sort = router.parseSortParameter(req, 'sort');
                        queryData.include = router.parseIncludeParameter(req);
                        queryData.offset = router.parseIntegerParameter(req, 'offset');
                        queryData.limit = router.parseIntegerParameter(req, 'limit');
                
                        console.log('  query: %s', JSON.stringify(queryData));
                    } catch (error) {
                        return router.respondError(error, res, next);
                    }
            
                    if (req.params.operation && !_.contains(supportedOperations, operation)) {
                        return router.respondError(new errors.BackeryInvalidParametersError('Unsupported query operation `' + operation + '`'), res, next);
                    }
                
                    var entity = application.Backery.Model[entityDefinition.name];
                    var query = !relationField ? entity.query() :
                        entity.load(req.params.objectId).relation(relationField.name).query();
                
                    try {
                        if (queryData.where)
                            query.where(queryData.where);
        
                        if (queryData.sort)
                            query.sort(queryData.sort);

                        query.include(queryData.include, (operation != 'count' && !queryData.include || queryData.include));

                        if (!_.isUndefined(queryData.offset))
                            query.offset(queryData.offset);
            
                        if (!_.isUndefined(queryData.limit))
                            query.limit(queryData.limit);
                    } catch (error) {
                        return router.respondError(error, res, next);
                    }
                
                    router.processRequest(new requests.QueryRequest(query, router.toCamelCase(operation || 'find'),
                        req.user ? req.user.object : undefined, application.Backery), req.backeryShouldRespondVerbose, res, next);
                };
            }
        
            var queryBasePath = '/' + router.entityPath(entityDefinition, isPlural);
            api.get(queryBasePath, queryHandler('find'));
            console.log('    query: GET ' + api.mountpath + queryBasePath + '/[' + supportedOperations.join('|') + ']');
        
            _.each(supportedOperations, function(operation) {
                api.get(queryBasePath + '/' + operation, queryHandler(operation));
            });
        
            _.each(entityDefinition.fields, function(field) {
                if (field.type.isRelationMany()) {
                    var path = queryBasePath + '/:objectId/' + (isPlural ? router.toURLCase(field.name) : field.name);
                
                    api.get(path, queryHandler('find', field));
                    console.log('    query: GET ' + api.mountpath + path + '/[' + supportedOperations.join('|') + ']');
                
                    _.each(supportedOperations, function(operation) {
                        api.get(path + '/' + operation, queryHandler(operation, field));
                    });
                }
            });
        });
    }
}