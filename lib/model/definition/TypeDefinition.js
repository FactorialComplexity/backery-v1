var _ = require('underscore');

var EntityReference = require('./EntityReference.js');
var FieldReference = require('./FieldReference.js');

var Types = {
    String: 1,
    Integer: 2,
    Number: 3,
    Boolean: 4,
    File: 5,
    Array: 6,
    Object: 7,
    
    Relation_Many: 10,
    Relation_One: 11
};

function isTypeRelation(type) {
    return type == Types.Relation_Many || type == Types.Relation_One;
}

var TypeDefinition = function(data) {
    
    if (_.isString(data)) {
        if (Types[data] && !isTypeRelation(Types[data])) {
            this.value = Types[data];
        }
    } else if (_.isObject(data) && _.isString(data['relation'])) {
        this.value = Types['Relation_' + data['relation']];
        
        if (!this.value)
            throw new Error('Incorrect relation type');
        
        this.relatedEntity = new EntityReference(data['entity']);
        
        if (data['reverse'])
            this.reverse = new FieldReference(this.relatedEntity, data['reverse']);
    }
    
    if (!this.value)
        throw new Error('Incorrect field type');
}

_.each(Types, function(value, key) {
    TypeDefinition[key] = value;
});

TypeDefinition.prototype.isRelation = function() {
    return isTypeRelation(this.value);
}

TypeDefinition.prototype.isRelationOne = function() {
    return this.value == Types.Relation_One;
}

TypeDefinition.prototype.isRelationMany = function() {
    return this.value == Types.Relation_Many;
}

module.exports = TypeDefinition;
