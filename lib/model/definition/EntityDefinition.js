var _ = require('underscore');

var FieldDefinition = require('./FieldDefinition.js');
var AccessDefinition = require('./AccessDefinition.js');

var EntityDefinition = function(data) {
    
    this.name = data.name;
    if (!this.name)
        throw new Error('Missing name for entity');

    this.fields = _.object(_.map(data.fields, function(fieldData) {
        return [fieldData.name, new FieldDefinition(fieldData)];
    }));
    
    this.access = new AccessDefinition(data.access);
}

EntityDefinition.User = function() {
    return new EntityDefinition({
        name: 'User',
        fields: [ ]
    });
}


module.exports = EntityDefinition;
