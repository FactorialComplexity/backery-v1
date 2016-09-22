var _ = require('underscore');

var RoleReference = require('./RoleReference.js');

var Operations = {
    Read: 'read',
    Create: 'create',
    Update: 'update',
    Delete: 'delete',
    Query: 'query'
};

var EntityAccessDefinition = function(accessData) {
    var self = this;
    self.allow = { };
    
    if (accessData) {
        _.each(accessData, function(roles, operation) {
            var operationName = operation.substring(0, 1).toUpperCase() + operation.substring(1);
            var operation = Operations[operationName];
        
            if (!operation) {
                throw new Error('Unknown operation: ' + operationName);
            }
        
            self.allow[operation] = _.map(roles, function(role) {
                if (_.isString(role))
                    return new RoleReference(role);
                else
                    return role;
            });
        });
    }
}

EntityAccessDefinition.prototype.merged = function(accessDefinition) {
    var ret = new EntityAccessDefinition();
    ret.allow = _.extend(this.allow, accessDefinition.allow);
    return ret;
}

EntityAccessDefinition.Operation = {}

_.each(Operations, function(value, key) {
    EntityAccessDefinition.Operation[key] = value;
});

module.exports = EntityAccessDefinition;
