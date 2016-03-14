var _ = require('underscore');

var RoleReference = require('./RoleReference.js');

var RoleDefinition = function(data, virtual) {
    
    this.name = data.name;
    if (!this.name)
        throw new Error('Missing name for role');
    
    this.include = _.map(data.include, function(includeName) {
        return new RoleReference(includeName);
    });

    this.isVirtual = function() {
        return virtual;
    };
}


RoleDefinition.reservedRoles = {
    User: new RoleDefinition({ name: 'User' }, true),
    Public: new RoleDefinition({ name: 'Public' }, true)
};

module.exports = RoleDefinition;
