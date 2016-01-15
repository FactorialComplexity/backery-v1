var _ = require('underscore');

var FieldReference = function(entityReference, fieldName) {
    this.entityReference = entityReference;
    
    if (_.isString(fieldName)) {
        this.fieldName = fieldName;
    } else {
        throw new Error('Field reference expected');
    }
}

module.exports = FieldReference;
