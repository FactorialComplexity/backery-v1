var _ = require('underscore');

var errors = require('../utils/errors.js');

var parsing = require('../utils/parsing.js')

module.exports = function(api, application, entityDefinition, router) {
    if (entityDefinition.access.allow['delete'].length) {
        _.each([true, false], function(isPlural) {
            api.delete('/' +  router.entityPath(entityDefinition, isPlural) + '/:objectId', function(req, res, next) {
                console.log('DELETE %s (user: %s)', req.url, req.user ? req.user.objectId() : 'none');
            
                router.processRequest(new application.Request.Delete(application.Backery.Model[entityDefinition.name], req.params.objectId,
                    req.user, application.Backery), req.backeryShouldRespondVerbose, req, res, next);
            });
        
            console.log('    delete: DELETE ' + api.mountpath + '/' +  router.entityPath(entityDefinition, isPlural) + '/:objectId');
        });
    }
}
