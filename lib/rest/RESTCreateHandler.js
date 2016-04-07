var _ = require('underscore');

var errors = require('../utils/errors.js');
var requests = require('../api/requests.js');

var parsing = require('../utils/parsing.js')

module.exports = function(server, application, basePath, entityDefinition, router) {
    if (entityDefinition.access.allow['create'].length) {
        _.each([true, false], function(isPlural) {
            server.post(basePath + '/' +  router.entityPath(entityDefinition, isPlural), function(req, res, next) {
                console.log('POST %s %j (user: %s)', req.url, req.body, req.user ? req.user.id : 'none');
                
                var include;
                try {
                    var include = router.parseIncludeParameter(req);
                    if (include)
                        console.log('  include: %j', include);
                } catch (error) {
                    return router.respondError(error, res, next);
                }
                
                var body = req.body;
                
                if (req.is('multipart/form-data')) {
                    body = {body: {}, files: req.files};
                    if (req.body.json)
                      body['body'] = JSON.parse(req.body.json);
                }
                
                router.processRequest(new requests.CreateOrUpdateRequest(application.Backery.Model[entityDefinition.name], undefined,
                    body, include, req.user, application.Backery), req.backeryShouldRespondVerbose, res, next, 201);
            });
            
            console.log('    create: POST ' + basePath + '/' +  router.entityPath(entityDefinition, isPlural));
            
            // TODO: Create with relation
        });
    }
}
