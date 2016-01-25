var _ = require('underscore');

var RoleReference = require('./RoleReference.js');

var RoleDefinition = function(data) {
    
    this.name = data.name;
    if (!this.name)
        throw new Error('Missing name for role');
    
    this.include = _.map(data.include, function(includeName) {
        return new RoleReference(includeName);
    });
}

RoleDefinition.User = function() {
    return new RoleDefinition({ name: 'User' });
}

RoleDefinition.reservedRoles = {
    User: RoleDefinition.User
};

module.exports = RoleDefinition;
