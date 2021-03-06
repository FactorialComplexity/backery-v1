var _ = require('underscore');

var TypeDefinition = require('./TypeDefinition.js');
var FieldAccessDefinition = require('./FieldAccessDefinition.js');

var FieldDefinition = function(data) {
    
    this.name = data.name;
    if (!this.name)
        throw new Error('Missing name for field');
    
    if (!data.type)
        throw new Error('Missing type for field');
    this.type = new TypeDefinition(data.type);
    
    this.unique = data['unique'];
    
    if (this.unique && this.type.isRelationMany()) {
        throw new Error('Unique is not supported for many-relations');
    }
    
    this.virtual = data['virtual'] || false;
    if (!_.isBoolean(this.virtual)) {
        throw new Error('Value for `virtual` should have boolean type');
    }
    
    if (this.virtual && this.type.isRelationMany()) {
        throw new Error('Virtual is not supported for many-relations');
    }
    
    this.explicitAccess = data.access ? new FieldAccessDefinition(data.access) : undefined;
}

module.exports = FieldDefinition;
