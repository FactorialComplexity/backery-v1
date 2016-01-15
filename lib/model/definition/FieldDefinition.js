var _ = require('underscore');

var TypeDefinition = require('./TypeDefinition.js');
var AccessDefinition = require('./AccessDefinition.js');

var FieldDefinition = function(data) {
    
    this.name = data.name;
    if (!this.name)
        throw new Error('Missing name for field');
    
    if (!data.type)
        throw new Error('Missing type for field');
    this.type = new TypeDefinition(data.type);
    
    this.access = new AccessDefinition(data.access);
}

module.exports = FieldDefinition;
