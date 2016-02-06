var _ = require('underscore');
var pluralize = require('pluralize');

var FieldDefinition = require('./FieldDefinition.js');
var EntityAccessDefinition = require('./EntityAccessDefinition.js');
var BackerFile = require('../BackerFile.js');

var errors = require('../../utils/errors.js');
var parse = require('../../utils/parse.js');

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

// /**
//  * Validates the JSON values meant for creating or updating the entity object against the model.
//  * @param values JSON values
//  * @return BackerTypeError if any error is found, undefined if values passed the validation
//  */
// EntityDefinition.prototype.getValuesValidationError = function(values, isForCreate) {
//
// }

function hasNotAllowedKeys(object, allowedKeys) {
    return _.difference(allowedKeys, _.keys(object)).length > 0;
}

/**
 * Converts JSON values into correct values object that can be used with Backer.<Entity>.create().
 * Transforms date literals into Date objects, backer object ids into Backer.<Entity>, file JSONs
 * into File objects.
 * @param values JSON values
 * @param Backer root object for Backer types
 * @param isForCreate true if this values are going to be used for creating new object, false - update existing
 * @return converted values object
 * @throw BackerTypeError if values didn't pass validation
 */
EntityDefinition.prototype.prepareValues = function(values, entities, isForCreate) {
    var self = this;
    var invalidFields = [];
    var converted = {};
    
    /// Recursively validates array or object
    function validateCompositeValue(composite, path) {
        if (_.contains(path, composite)) {
            // circular link
            return false;
        }
        
        return !_.detect(composite, function(value) {
            if ((_.isArray(value) || _.isObject(value)) && !_.isFunction(value)) {
                if (!path)
                    path = new Array();
                path.push(value);
                
                if (!validateCompositeValue(value, path))
                    return true;
            } else if (!(_.isString(value) || _.isNumber(value) || _.isBoolean(value)
                || _.isNull(value) || _.isUndefined(value))) {
                
                // unsupported value
                return true;
            }
        });
    }
    
    
    _.each(values, function(value, key) {
        if (self.fields[key]) {
            if (self.fields[key].type.isString()) {
                if (!_.isString(value)) {
                    invalidFields.push([key, 'Value is not a string']);
                } else {
                    converted[key] = value;
                }
            } else if (self.fields[key].type.isInteger()) {
                var cvalue = parse.parseInt(value);
                if (_.isNaN(cvalue)) {
                    invalidFields.push([key, 'Value is not an integer']);
                } else {
                    converted[key] = cvalue;
                }
            } else if (self.fields[key].type.isNumber()) {
                var cvalue = parse.parseFloat(value);
                if (_.isNaN(cvalue)) {
                    invalidFields.push([key, 'Value is not a number']);
                } else {
                    converted[key] = cvalue;
                }
            } else if (self.fields[key].type.isBoolean()) {
                if (!_.isBoolean(value)) {
                    invalidFields.push([key, 'Value is not a boolean']);
                } else {
                    converted[key] = value;
                }
            } else if (self.fields[key].type.isDate()) {
                var cvalue = parse.parseISODate(value);
                if (!cvalue) {
                    invalidFields.push([key, 'Value is not a date in ISO-8601 format']);
                } else {
                    converted[key] = cvalue;
                }
            } else if (self.fields[key].type.isArray()) {
                if (!_.isArray(value)) {
                    invalidFields.push([key, 'Value is not an array']);
                } else if (!validateCompositeValue(value)) {
                    invalidFields.push([key, 'Array contains unsupported values']);
                } else {
                    converted[key] = value;
                }
            } else if (self.fields[key].type.isObject()) {
                if (!_.isObject(value) || _.isArray(value) || _.isFunction(value)) {
                    invalidFields.push([key, 'Value is not an object']);
                } else if (!validateCompositeValue(value)) {
                    invalidFields.push([key, 'Object contains unsupported values']);
                } else {
                    converted[key] = value;
                }
            } else if (self.fields[key].type.isFile()) {
                try {
                    converted[key] = new BackerFile(value);
                } catch (error) {
                    invalidFields.push([key, 'Value is not a correct File object']);
                }
            
            } else if (self.fields[key].type.isRelationOne()) {
                if (!_.isString(value)) {
                    invalidFields.push([key, 'Value is not an objectId']);
                } else {
                    converted[key] = entities[self.fields[key].type.realtedEntity.name].ref(value);
                }
            } else if (self.fields[key].type.isRelationMany()) {
                
                if (_.isObject(value) && !_.isArray(value) && !_.isFunction(value)) {
                    // Can be Backer.RelationOperation type data...
                    try {
                        converted[key] = entities[self.fields[key].type.relatedEntity.name].RelationOperation.load(value);
                    } catch (error) {
                        invalidFields.push([key, 'Value is not a correct RelationOperation object']);
                    }
                    
                } else if (_.isArray(value)) {
                    // ...or a list of objectIds, in which case they work as Backer.Op with type='set'
                    try {
                        converted[key] = entities[self.fields[key].type.relatedEntity.name].RelationOperation.Set(value);
                    } catch (error) {
                        console.log(error.stack)
                        invalidFields.push([key, 'Value is not a correct array of objectIds for many relation']);
                    }
                }
            }
        } else {
            invalidFields.push([key, 'Field is not defined in the model']);
        }
    });
    
    if (invalidFields.length) {
        throw new errors.BackerInvalidParametersError('Invalid fields in values: ' +
            _.map(invalidFields, function(fieldTulip) {
                return fieldTulip[0] + ' (' + fieldTulip[1] + ')'
            }).join(', '),
            _.map(invalidFields, function(fieldTulip) {
                return fieldTulip[0];
            }));
    }
    
    return converted;
}

EntityDefinition.prototype.prepareInclude = function(include) {
    var self = this;
    
    if (!_.isArray(include)) {
        throw new errors.BackerInvalidParametersError('Invalid include object');
    }
    
    return _.map(include, function(inc) {
        var fieldName, range;
    
        if (_.isString(inc)) {
            fieldName = inc;
            range = {};
        
        } else if (_.isObject(inc) && !_.isArray(inc) && !_.isFunction(inc)) {
            var keys = _.keys(inc);
            if (keys.length == 1) {
                fieldName = keys[0];
                if (_.isObject(inc[fieldName]) && !_.isArray(inc[fieldName]) && !_.isFunction(inc[fieldName]) &&
                        !hasNotAllowedKeys(inc[fieldName], ['offset', 'limit'])) {
                    
                    range = inc[fieldName];
                    
                    if (!((_.isNumber(range.offset) || _.isUndefined(range.offset)) &&
                            (_.isNumber(range.limit) || _.isUndefined(range.limit)))) {
                        throw new errors.BackerInvalidParametersError('Invalid include object, range is incorrect for field: `' + fieldName + '`');
                    }
                    
                    if (!range.offset && range.limit)
                        range.offset = 0;
                } else {
                    throw new errors.BackerInvalidParametersError('Invalid include object, range is incorrect for field: `' + fieldName + '`');
                }
            } else {
                throw new errors.BackerInvalidParametersError('Invalid include object');
            }
        } else {
            throw new errors.BackerInvalidParametersError('Invalid include object');
        }
    
        var field = self.fields[fieldName];
        if (field.type.isRelationManyToMany() && _.keys(range).length) {
            throw new errors.BackerInvalidParametersError('Invalid include object, range is not currently supported for many-to-many relations. Field: `' +
                fieldName + '`');
        } else if (field.type.isRelationMany()) {
            return _.extend({ field: field.name }, range);
        } else if (field.type.isRelationOne()) {
            if (_.keys(range).length == 0) {
                return { field: field.name };
            } else {
                throw new errors.BackerInvalidParametersError('Invalid include object, range is not applicable for the field: `' +
                    fieldName + '` (to-one relation)');
            }
        } else {
            throw new errors.BackerInvalidParametersError('Invalid field to include: `' + field.name + '`');
        } 
    });
}
    
EntityDefinition.User = function() {
    return new EntityDefinition({
        name: EntityDefinition.userEntityName,
        fields: [ ]
    });
}

module.exports = EntityDefinition;
