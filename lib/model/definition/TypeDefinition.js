var _ = require('underscore');

var EntityReference = require('./EntityReference.js');
var FieldReference = require('./FieldReference.js');

var Types = {
    String: 1,
    Integer: 2,
    Number: 3,
    Boolean: 4,
    Date: 5,
    Array: 6,
    Dictionary: 7,
    File: 8,

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

TypeDefinition.prototype.isString = function() {
    return this.value == Types.String;
}

TypeDefinition.prototype.isInteger = function() {
    return this.value == Types.Integer;
}

TypeDefinition.prototype.isNumber = function() {
    return this.value == Types.Number;
}

TypeDefinition.prototype.isNumeric = function() {
    return this.isInteger() || this.isNumber();
}

TypeDefinition.prototype.isBoolean = function() {
    return this.value == Types.Boolean;
}

TypeDefinition.prototype.isDate = function() {
    return this.value == Types.Date;
}

TypeDefinition.prototype.isArray = function() {
    return this.value == Types.Array;
}

TypeDefinition.prototype.isDictionary = function() {
    return this.value == Types.Dictionary;
}

TypeDefinition.prototype.isFile = function() {
    return this.value == Types.File;
}

TypeDefinition.prototype.isRelation = function() {
    return isTypeRelation(this.value);
}

TypeDefinition.prototype.isRelationOne = function() {
    return this.value == Types.Relation_One;
}

TypeDefinition.prototype.isRelationMany = function() {
    return this.value == Types.Relation_Many;
}

TypeDefinition.prototype.isRelationManyToMany = function() {
    return this.value == Types.Relation_Many &&
        this.reverse && this.reverse.type.value == Types.Relation_Many;
}

module.exports = TypeDefinition;
