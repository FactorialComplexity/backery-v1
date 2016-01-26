var restify = require('restify');
var _ = require('underscore');

module.exports = function(port, applicationName, modelDefinition, worker, callback) {
    // Create server
    var server = restify.createServer({
        name: applicationName
    });
    
    // Configure API paths
    _.each(modelDefinition.entities, function(entityDefinition) {
        
    });
    
    // Listen
    server.listen(port, callback);
};
