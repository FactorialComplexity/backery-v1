var _ = require('underscore');

var RoleReference = require('./RoleReference.js');

var Operations = {
    Read: 'read',
    Write: 'write'
};

var FieldAccessDefinition = function(accessData) {
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

FieldAccessDefinition.prototype.toString = function() {
    return JSON.stringify({
        read: _.map(this.allow.read, function(role) {
            return role.name;
        }),
        
        write: _.map(this.allow.write, function(role) {
            return role.name;
        })
    });
}

FieldAccessDefinition.prototype.merged = function(accessDefinition) {
    var ret = new FieldAccessDefinition();
    ret.allow = _.extend(this.allow, accessDefinition ? accessDefinition.allow : {});
    return ret;
}

FieldAccessDefinition.Operation = {}

_.each(Operations, function(value, key) {
    FieldAccessDefinition.Operation[key] = value;
});

module.exports = FieldAccessDefinition;
