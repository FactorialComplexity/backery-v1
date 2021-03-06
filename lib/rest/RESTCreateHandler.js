var _ = require('underscore');

var errors = require('../utils/errors.js');

var parsing = require('../utils/parsing.js')

module.exports = function(api, application, entityDefinition, router) {
    if (entityDefinition.access.allow['create'].length) {
        _.each([true, false], function(isPlural) {
            api.post('/' +  router.entityPath(entityDefinition, isPlural), function(req, res, next) {
                console.log('POST %s %j (user: %s)', req.url, req.body, req.user ? req.user.objectId() : 'none');
                console.log('---------------------- REQUEST BODY')
                console.dir(req)
                
                var include;
                try {
                    var include = router.parseIncludeParameter(req);
                    if (include)
                        console.log('  include: %j', include);
                } catch (error) {
                    return next(error);
                }
                
                var body = req.body;
                var file;
                
                if (req.is('multipart/form-data')) {
                    console.log('---------------------- REQUEST BODY')
                    console.dir(req.body)
                    if (req.body.json)
                        body = JSON.parse(req.body.json);
                    else
                        body = {};
                    
                    var fileUpload = req.body.body;
                    if (!fileUpload || !fileUpload.path) {
                        return next(new errors.BackeryInvalidParametersError('File data is expected under key `body`'));
                    }
                    
                    file = {
                        path: fileUpload.path,
                        name: fileUpload.name,
                        contentType: fileUpload.type,
                        size: fileUpload.size,
                        preserveName: body._preserveName
                    };
                    
                    delete body._preserveName;
                }
                
                if (_.isUndefined(body))
                    return next(new errors.BackeryInvalidParametersError('JSON data is expected under key `json`'));
                
                router.processRequest(new application.Request.CreateOrUpdate(application.Backery.Model[entityDefinition.name], undefined,
                    body, file, include, req.user, application.Backery), req.backeryShouldRespondVerbose, req, res, next, 201);
            });
            
            console.log('    create: POST ' + api.mountpath + '/' +  router.entityPath(entityDefinition, isPlural));
            
            // TODO: Create with relation
        });
    }
}
