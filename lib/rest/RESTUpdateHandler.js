var _ = require('underscore');

var errors = require('../utils/errors.js');
var requests = require('../api/requests.js');

var parsing = require('../utils/parsing.js')

module.exports = function(server, application, basePath, entityDefinition, router) {
    if (entityDefinition.access.allow['update'].length) {
        _.each([true, false], function(isPlural) {
            server.put(basePath + '/' +  router.entityPath(entityDefinition, isPlural) + '/:objectId', function(req, res, next) {
                console.log('PUT %s %j (user: %s)', req.url, req.body, req.user ? req.user.id : 'none');
                
                var include;
                try {
                    var include = router.parseIncludeParameter(req);
                    if (include)
                        console.log('  include: %j', include);
                } catch (error) {
                    return router.respondError(error, res, next);
                }
                
                router.processRequest(new requests.CreateOrUpdateRequest(application.Backery.Model[entityDefinition.name], req.params.objectId,
                    req.body, undefined, include, req.user ? req.user.object : undefined, application.Backery), req.backeryShouldRespondVerbose, res, next);
            });
            
            console.log('    update: PUT ' + basePath + '/' +  router.entityPath(entityDefinition, isPlural) + '/:objectId');
            
            // TODO: Update separate fields
        });
    }
}
