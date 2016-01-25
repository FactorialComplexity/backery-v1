var _ = require('underscore');

var FieldReference = function(entityReference, fieldName) {
    this.isReference = true;
    this.entityReference = entityReference;
    
    if (_.isString(fieldName)) {
        this.fieldName = fieldName;
    } else {
        throw new Error('Field reference expected');
    }
}

module.exports = FieldReference;
