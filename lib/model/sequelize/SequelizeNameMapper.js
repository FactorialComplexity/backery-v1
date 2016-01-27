var names = require('../../utils/names.js');

module.exports = SequelizeNameMapper = {};

SequelizeNameMapper.sequelizeModelName = function(entityDefinition) {
    return entityDefinition.name;
}

SequelizeNameMapper.sequelizeFieldName = function(fieldDefinition) {
    return fieldDefinition.name;
}

SequelizeNameMapper.sequelizeAssociationAs = function(fieldDefinition) {
    return names.toUpperCaseFirstLetter(fieldDefinition.name);
}

SequelizeNameMapper.sequelizeAssociationForeignKey = function(fieldDefinition) {
    return '_' + fieldDefinition.name + 'Id';
}

SequelizeNameMapper.sequelizeAssociationThrough = function(entityDefinition, fieldDefinition,
    relatedEntityDefinition, reverseFieldDefinition) {
        
    if (!relatedEntityDefinition) {
        relatedEntityDefinition = fieldDefinition.type.relatedEntity;
        reverseFieldDefinition = fieldDefinition.type.reverse;
    }
    
    if (entityDefinition.name < relatedEntityDefinition.name) {
        var tmpEntity = relatedEntityDefinition;
        relatedEntityDefinition = entityDefinition;
        entityDefinition = tmpEntity;
        
        var tmpField = reverseFieldDefinition;
        reverseFieldDefinition = fieldDefinition;
        fieldDefinition = tmpField;
    }
    
    return '_' + entityDefinition.name + (fieldDefinition ? ('_' + fieldDefinition.name) : '') + '_' +
        relatedEntityDefinition.name + (reverseFieldDefinition ? ('_' + reverseFieldDefinition.name) : '');
}
