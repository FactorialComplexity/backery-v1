var _ = require('underscore');

var errors = require('../utils/errors.js');
var requests = require('../api/requests.js');

var parsing = require('../utils/parsing.js')

module.exports = function(server, application, basePath, entityDefinition, router) {
    if (entityDefinition.access.allow['delete'].length) {
        _.each([true, false], function(isPlural) {
            server.del(basePath + '/' +  router.entityPath(entityDefinition, isPlural) + '/:objectId', function(req, res, next) {
                console.log('DELETE %s (user: %s)', req.url, req.user ? req.user.id : 'none');
            
                router.processRequest(new requests.DeleteRequest(application.Backery.Model[entityDefinition.name], req.params.objectId,
                    req.user ? req.user.object : undefined,
 application.Backery), req.backeryShouldRespondVerbose, res, next);
            });
        
            console.log('    delete: DELETE ' + basePath + '/' +  router.entityPath(entityDefinition, isPlural) + '/:objectId');
        });
    }
}
