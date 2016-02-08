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

RoleDefinition.reservedRoles = {
    User: new RoleDefinition({ name: 'User' }),
    Owner: new RoleDefinition({ name: 'Owner' }),
};

module.exports = RoleDefinition;
