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
    
    this.explicitAccess = new FieldAccessDefinition(data.access);
}

module.exports = FieldDefinition;
