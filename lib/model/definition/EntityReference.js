var _ = require('underscore');

var EntityReference = function(name) {
    this.isReference = true;
    
    if (_.isString(name)) {
        this.entityName = name;
    } else {
        throw new Error('Entity reference expected');
    }
}

module.exports = EntityReference;
