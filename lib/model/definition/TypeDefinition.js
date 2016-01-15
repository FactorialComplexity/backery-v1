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
    
    Association_ManyToMany: 10,
    Association_OneToMany: 11,
    Association_ManyToOne: 12,
    Association_OneToMany: 13
};

function isTypeAssociation(type) {
    return type == Types.Association_ManyToMany || type == Types.Association_OneToMany ||
        type == Types.Association_ManyToOne || type == Types.Association_OneToMany;
}

var TypeDefinition = function(data) {
    
    if (_.isString(data)) {
        if (Types[data] && !isTypeAssociation(Types[data])) {
            this.value = Types[data];
        }
    } else if (_.isObject(data) && _.isString(data['association'])) {
        this.value = Types['Association_' + data['association']];
        
        if (!this.value)
            throw new Error('Incorrect association type');
        
        this.associatedEntity = new EntityReference(data['entity']);
        
        if (data['reverse'])
            this.reverse = new FieldReference(this.associatedEntity, data['reverse']);
        
        if (data['through'])
            this.associatedThrough = new EntityReference(data['through']);
    }
    
    if (!this.value)
        throw new Error('Incorrect field type');
}

_.each(Types, function(value, key) {
    TypeDefinition[key] = value;
});

TypeDefinition.prototype.isAssociation = function() {
    return isTypeAssociation(this.value);
}

module.exports = TypeDefinition;
