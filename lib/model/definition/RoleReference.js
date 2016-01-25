var _ = require('underscore');

var RoleReference = function(name) {
    this.isReference = true;
    
    if (_.isString(name)) {
        this.roleName = name;
    } else {
        throw new Error('Role reference expected');
    }
}

module.exports = RoleReference;
