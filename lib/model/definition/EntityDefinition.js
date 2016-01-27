var _ = require('underscore');
var pluralize = require('pluralize');

var FieldDefinition = require('./FieldDefinition.js');
var EntityAccessDefinition = require('./EntityAccessDefinition.js');

var EntityDefinition = function(data) {
    
    if (!data.name)
        throw new Error('Missing name for entity');
    
    if (_.isObject(data.name)) {
        if (!data.name.singular)
            throw new Error('Missing name for entity');
        
        this.name = data.name.singular;
        this.pluralName = data.name.plural;
    } else {
        this.name = data.name;
    }
    
    if (!this.pluralName) {
        this.pluralName = pluralize(this.name);
    }
    
    this.fields = _.object(_.map(data.fields, function(fieldData) {
        return [fieldData.name, new FieldDefinition(fieldData)];
    }));
    
    this.explicitAccess = new EntityAccessDefinition(data.access);
}

EntityDefinition.userEntityName = 'User';

EntityDefinition.prototype.isUserEntity = function() {
    return this.name == EntityDefinition.userEntityName;
}

EntityDefinition.prototype.getURLName = function(plural) {
    return this.name;
}

EntityDefinition.User = function() {
    return new EntityDefinition({
        name: EntityDefinition.userEntityName,
        fields: [ ]
    });
}

module.exports = EntityDefinition;
