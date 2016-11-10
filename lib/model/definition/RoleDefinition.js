var _ = require('underscore');

var RoleReference = require('./RoleReference.js');

var RoleDefinition = function(data, options) {
    if (_.isString(data)) {
        data = { name: data };
    }
    
    this.name = data.name;
    if (!this.name)
        throw new Error('Missing name for role');
    
    if (options && options.contextual) {
        this.relationPath = options.relationPath;
    }
    
    this.include = _.map(data.include, function(includeName) {
        return new RoleReference(includeName);
    });

    this.isVirtual = function() {
        return !!(options && options.virtual);
    };
    
    this.isContextual = function() {
        return !!(options && options.contextual);
    };
}

RoleDefinition.reservedRoles = {
    User: new RoleDefinition('User', { virtual: true }),
    Public: new RoleDefinition('Public', { virtual: true })
};

RoleDefinition.contextual = function(name, relationPath) {
    return new RoleDefinition(name, {
        contextual: true,
        relationPath: relationPath
    });
}

module.exports = RoleDefinition;
