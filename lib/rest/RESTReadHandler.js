var _ = require('underscore');

var errors = require('../utils/errors.js');
var requests = require('../api/requests.js');

var parsing = require('../utils/parsing.js')

module.exports = function(server, application, basePath, entityDefinition, router) {
    if (entityDefinition.access.allow['read'].length) {
        _.each([true, false], function(isPlural) {
            server.get(basePath + '/' +  router.entityPath(entityDefinition, isPlural) + '/:objectId', function(req, res, next) {
                console.log('GET %s (user: %s)', req.url, req.user ? req.user.id : 'none');
    
                var include;
                try {
                    var include = router.parseIncludeParameter(req);
                    if (include)
                        console.log('  include: %j', include);
                } catch (error) {
                    return router.respondError(error, res, next);
                }
    
                router.processRequest(new requests.ReadRequest(application.Backery.Model[entityDefinition.name], req.params.objectId, include,
                    req.user, application.Backery), req.backeryShouldRespondVerbose, res, next);
            });

            console.log('    read: GET ' + basePath + '/' +  router.entityPath(entityDefinition, isPlural) + '/:objectId');

            // TODO: Read separate fields
        });
    }
}