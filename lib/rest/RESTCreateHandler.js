var _ = require('underscore');

var errors = require('../utils/errors.js');
var requests = require('../api/requests.js');

var parsing = require('../utils/parsing.js')

module.exports = function(api, application, entityDefinition, router) {
    if (entityDefinition.access.allow['create'].length) {
        _.each([true, false], function(isPlural) {
            api.post('/' +  router.entityPath(entityDefinition, isPlural), function(req, res, next) {
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
                var file;
                
                if (req.is('multipart/form-data')) {
                    if (req.body.json)
                        body = JSON.parse(req.body.json);
                    else
                        body = {};
                    file = {
                        path: req.files.body.path,
                        name: req.files.body.name,
                        contentType: req.files.body.type,
                        size: req.files.body.size
                    };
                }
                
                if (_.isUndefined(body))
                    return router.respondError(new errors.BackeryInvalidParametersError('Body can`t be empty'), res, next);
                
                router.processRequest(new requests.CreateOrUpdateRequest(application.Backery.Model[entityDefinition.name], undefined,
                    body, file, include, req.user ? req.user.object : undefined, application.Backery), req.backeryShouldRespondVerbose, res, next, 201);
            });
            
            console.log('    create: POST ' + api.mountpath + '/' +  router.entityPath(entityDefinition, isPlural));
            
            // TODO: Create with relation
        });
    }
}
