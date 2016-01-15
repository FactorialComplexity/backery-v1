var _ = require('underscore');

var RoleReference = require('./RoleReference.js');

var Operations = {
    Read: 'read',
    Create: 'create',
    Update: 'update',
    Delete: 'delete'
};

var AccessDefinition = function(accessData) {
    var self = this;
    self.allow = { };
    
    if (accessData) {
        _.each(accessData, function(roles, operation) {
            var operationName = operation.substring(0, 1).toUpperCase() + operation.substring(1);
            var operation = Operations[operationName];
        
            if (!operation) {
                throw new Error('Unknown operation: ' + operationName);
            }
        
            self.allow[operation] = _.map(roles, function(roleName) {
                return new RoleReference(roleName);
            });
        });
    }
}

AccessDefinition.Operation = {}

_.each(Operations, function(value, key) {
    AccessDefinition.Operation[key] = value;
});

module.exports = AccessDefinition;
