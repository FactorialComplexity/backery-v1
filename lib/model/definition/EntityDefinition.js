var _ = require('underscore');
var pluralize = require('pluralize');

var FieldDefinition = require('./FieldDefinition.js');
var EntityAccessDefinition = require('./EntityAccessDefinition.js');
var BackeryFile = require('../BackeryFile.js');

var errors = require('../../utils/errors.js');
var parse = require('../../utils/parse.js');

var EntityDefinition = function(data, modelDefinition) {
    
    this.modelDefinition = modelDefinition;
    
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
EntityDefinition.fileEntityName = 'File';

EntityDefinition.prototype.isUserEntity = function() {
    return this.name == EntityDefinition.userEntityName;
}

EntityDefinition.prototype.isFileEntity = function() {
    return this.name == EntityDefinition.fileEntityName;
}

EntityDefinition.prototype.getURLName = function(plural) {
    return this.name;
}

// /**
//  * Validates the JSON values meant for creating or updating the entity object against the model.
//  * @param values JSON values
//  * @return BackeryTypeError if any error is found, undefined if values passed the validation
//  */
// EntityDefinition.prototype.getValuesValidationError = function(values) {
//
// }

function hasNotAllowedKeys(object, allowedKeys) {
    return _.difference(allowedKeys, _.keys(object)).length > 0;
}

/**
 * Converts JSON values into correct values object that can be used with Backery.Model.<Entity>.create().
 * Transforms date literals into Date objects, backer object ids into Backery.Model.<Entity>, file JSONs
 * into File objects.
 * @param values JSON values
 * @param Backer root object for Backer types
 * @return converted values object
 * @throw BackeryTypeError if values didn't pass validation
 */
EntityDefinition.prototype.prepareValues = function(values, entities) {
    var self = this;
    var invalidFields = [];
    var converted = {};

    var newValues = {};
    _.each(values, function(value, key) {
        if (!_.isUndefined(value)) {
            newValues[key] = value;
        }
    });
    values = newValues;

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
                if (!_.isString(value) && !_.isNull(value)) {
                    invalidFields.push([key, 'Value is not a string']);
                } else {
                    converted[key] = value;
                }
            } else if (self.fields[key].type.isInteger()) {
                var cvalue = parse.parseInt(value);
                if (_.isNaN(cvalue) && !_.isNull(value)) {
                    invalidFields.push([key, 'Value is not an integer']);
                } else {
                    converted[key] = _.isNull(value) ? null : cvalue;
                }
            } else if (self.fields[key].type.isNumber()) {
                var cvalue = parse.parseFloat(value);
                if (_.isNaN(cvalue) && !_.isNull(value)) {
                    invalidFields.push([key, 'Value is not a number']);
                } else {
                    converted[key] = _.isNull(value) ? null : cvalue;
                }
            } else if (self.fields[key].type.isBoolean()) {
                if (!_.isBoolean(value) && !_.isNull(value)) {
                    invalidFields.push([key, 'Value is not a boolean']);
                } else {
                    converted[key] = value;
                }
            } else if (self.fields[key].type.isDate()) {
                var cvalue = parse.parseISODate(value);
                if (!cvalue && !_.isNull(value)) {
                    invalidFields.push([key, 'Value is not a date in ISO-8601 format']);
                } else {
                    converted[key] = _.isNull(value) ? null : cvalue;
                }
            } else if (self.fields[key].type.isArray()) {
                if (!_.isArray(value) && !_.isNull(value)) {
                    invalidFields.push([key, 'Value is not an array']);
                } else if (!validateCompositeValue(value)) {
                    invalidFields.push([key, 'Array contains unsupported values']);
                } else {
                    converted[key] = JSON.stringify(value);
                }
            } else if (self.fields[key].type.isDictionary()) {
                if ((!_.isObject(value) || _.isArray(value) || _.isFunction(value))  && !_.isNull(value)) {
                    invalidFields.push([key, 'Value is not an dictionary']);
                } else if (!validateCompositeValue(value)) {
                    invalidFields.push([key, 'Dictionary contains unsupported values']);
                } else {
                    converted[key] = JSON.stringify(value);
                }
            } else if (self.fields[key].type.isFile()) {
                try {
                    converted[key] = new BackeryFile(value);
                } catch (error) {
                    invalidFields.push([key, 'Value is not a correct File object']);
                }

            } else if (self.fields[key].type.isRelationOne()) {
                if (!_.isString(value) && !_.isNull(value)) {
                    invalidFields.push([key, 'Value is not an objectId']);
                } else {
                    converted[key] = _.isNull(value) ? null : entities[self.fields[key].type.relatedEntity.name].ref(value);
                }
            } else if (self.fields[key].type.isRelationMany()) {

                if (_.isObject(value) && !_.isArray(value) && !_.isFunction(value)) {
                    // Can be BackeryRelationOperation type data...
                    try {
                        converted[key] = entities[self.fields[key].type.relatedEntity.name].RelationOperation.FromData(value);
                    } catch (error) {
                        invalidFields.push([key, error.message]);
                    }

                } else if (_.isArray(value)) {
                    // ...or a list of objectIds, in which case they work as BackeryRelationOperation with type='set'
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
        throw new errors.BackeryInvalidParametersError('Invalid fields in values: ' +
            _.map(invalidFields, function(fieldTulip) {
                return fieldTulip[0] + ' (' + fieldTulip[1] + ')'
            }).join(', '),
            _.map(invalidFields, function(fieldTulip) {
                return fieldTulip[0];
            }));
    }
    return converted;
}

EntityDefinition.prototype.validatePasswordAuthentication = function(object) {
    var self = this;
    
    if (object.isRef())
        return;
    
    var passwordAuthMethod = _.find(self.modelDefinition.authMethods, function(authMethod) {
        return authMethod.isPassword();
    });
    
    var hasPassword = object.isPasswordSet();
    var hasAtLeastOneLoginField = false;
    _.each(passwordAuthMethod.loginFields, function(field) {
        hasAtLeastOneLoginField = hasAtLeastOneLoginField || !!object.get(field.name);
    });
    
    if (!hasPassword) {
        throw new errors.BackeryInvalidParametersError('Password for User cannot be empty');
    }
    
    if (!hasAtLeastOneLoginField) {
        throw new errors.BackeryInvalidParametersError('At least one of the login fields should be set: ' +
            _.map(passwordAuthMethod.loginFields, function(loginField) {
                return '\"' + loginField.name + '\"';
            }).join(', '));
    }
}

EntityDefinition.prototype.canBeAuthenticatedByPassword = function(object) {
    if (object.isRef())
        return;
    
    try {
        this.validatePasswordAuthentication(object);
    } catch (error) {
        return false;
    }
    
    return true;
}

EntityDefinition.prototype.canBeAuthenticatedByFacebook = function(object) {
    if (object.isRef())
        return;
    return !!object.getFacebookUserId();
}

EntityDefinition.prototype.validateBeforeSave = function(object) {
    var self = this;
    if (self.isUserEntity() && !object.isRef()) {
        
        // User object needs to have data for at least one of the auth methods
        if (!self.canBeAuthenticatedByPassword(object) && !self.canBeAuthenticatedByFacebook(object)) {
            throw new errors.BackeryInvalidParametersError('User object should have data for at least one authentication method');
        }
    }
}

EntityDefinition.prototype.prepareInclude = function(include) {
    var self = this;
    
    if (_.isUndefined(include))
        return;
    
    if (!_.isArray(include)) {
        throw new errors.BackeryInvalidParametersError('Invalid include object');
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
                        throw new errors.BackeryInvalidParametersError('Invalid include object, range is incorrect for field: `' + fieldName + '`');
                    }
                    
                    if (!range.offset && range.limit)
                        range.offset = 0;
                } else {
                    throw new errors.BackeryInvalidParametersError('Invalid include object, range is incorrect for field: `' + fieldName + '`');
                }
            } else {
                throw new errors.BackeryInvalidParametersError('Invalid include object');
            }
        } else {
            throw new errors.BackeryInvalidParametersError('Invalid include object');
        }
    
        var field = self.fields[fieldName];
        if (!field) {
            throw new errors.BackeryInvalidParametersError('Invalid include object, field not found: `' + fieldName + '`');
        }
        
        if (field.type.isRelationManyToMany() && _.keys(range).length) {
            throw new errors.BackeryInvalidParametersError('Invalid include object, range is not currently supported for many-to-many relations. Field: `' +
                fieldName + '`');
        } else if (field.type.isRelationMany()) {
            return _.extend({ field: field.name }, range);
        } else if (field.type.isRelationOne()) {
            if (_.keys(range).length == 0) {
                return { field: field.name };
            } else {
                throw new errors.BackeryInvalidParametersError('Invalid include object, range is not applicable for the field: `' +
                    fieldName + '` (to-one relation)');
            }
        } else {
            throw new errors.BackeryInvalidParametersError('Invalid field to include: `' + field.name + '`');
        } 
    });
}

EntityDefinition.prototype.prepareWhere = function(where, entities) {
    var self = this;
    if (_.isUndefined(where))
        return;
    
    if (!_.isObject(where)) {
        throw new errors.BackeryInvalidParametersError('Invalid where object');
    }
    
    function isValidQueryOperation(op) {
        return _.contains([ '$and', '$or', '$eq', '$ne', '$gte', '$gt', '$lte', '$lt', '$in', '$notIn', '$contains', '$containsCI' ], op);
    }
    
    function queryOperationSupportsValuesArray(op) {
        return _.contains([ '$in', '$notIn' ], op);
    }
    
    function fieldSupportsQueryOperation(key, field, op) {
        if (_.contains([ '$eq', '$ne', '$in', '$notIn' ], op)) {
            return true;
        }
        
        if (field && field.type.isString()) {
            // String
            return _.contains([ '$contains', '$containsCI' ], op);
        } else if (key == "createdAt" || key == "updatedAt" || (field && field.type.isDate())) {
            // Date
            return _.contains([ '$gte', '$gt', '$lte', '$lt' ], op);
        } else if (field && (field.type.isInteger() || field.type.isNumber())) {
            // Integer and Number
            return _.contains([ '$gte', '$gt', '$lte', '$lt' ], op);
        }
    }
    
    function validateAndTransformValue(key, field, value) {
        if (!_.isNull(value)) {
            var isDate = (key == "createdAt" || key == "updatedAt" || (field && field.type.isDate()));
            if (isDate) {
                value = new Date(value);
                if (!value) {
                    throw new errors.BackeryInvalidParametersError('Value is not a valid date in `where` object for key: `' + key + '`');
                }
            }
    
            var isString = (key == "id" || (field && field.type.isString()));
            if (isString && !_.isString(value)) {
                throw new errors.BackeryInvalidParametersError('Value is not a valid string in `where` object for key: `' + key + '`');
            }
    
            if (field && field.type.isInteger()) {
                value = parse.parseInt(value);
                if (_.isNaN(value)) {
                    throw new errors.BackeryInvalidParametersError('Value is not a valid integer in `where` object for key: `' + key + '`');
                }
            }
        
            if (field && field.type.isNumber()) {
                value = parse.parseFloat(value);
                if (_.isNaN(cvalue)) {
                    throw new errors.BackeryInvalidParametersError('Value is not a valid number in `where` object for key: `' + key + '`');
                }
            }
        
            if (field && field.type.isBoolean() && !_.isBoolean(value)) {
                throw new errors.BackeryInvalidParametersError('Value is not a valid boolean in `where` object for key: `' + key + '`');
            }
        
            if (field && field.type.isRelationOne()) {
                if (!_.isString(value)) {
                    throw new errors.BackeryInvalidParametersError('Value is not a valid object identifier in `where` object for key: `' + key + '`');
                }
            
                value = entities[field.type.relatedEntity.name].ref(value);
            }
        }
        
        return value;
    }
    
    function parseWhere(where) {
        return _.object(_.map(_(where).pairs(), function(pair) {
            var op = pair[0];
            if (!isValidQueryOperation(op)) {
                throw new errors.BackeryInvalidParametersError('Invalid `where` object, unsupported query operation `' + op + '`');
            }
            
            if (op == '$or' || op == '$and') {
                if (!_.isArray(pair[1]))
                    throw new errors.BackeryInvalidParametersError('Invalid parameters for query operation `' + op + '`');
                return [op, _.map(pair[1], function(pair) {
                    return parseWhere(pair);
                })];
            } else {
                var key = _.keys(pair[1])[0];
                var value = pair[1][key];
                
                // Check key for validity
                var field = self.fields[key];
                if (!field && key != "id" && key != "createdAt" && key != "updatedAt") {
                    throw new errors.BackeryInvalidParametersError('Invalid `where` object, key not found: `' + key + '`');
                }
                
                if (field && !(field.type.isDate() || field.type.isString() || field.type.isInteger() ||
                    field.type.isNumber() || field.type.isBoolean() || field.type.isRelationOne())) {
                    
                    throw new errors.BackeryInvalidParametersError('Key is not of queryable type: `' + key + '`');
                }
                
                // Validate and transform values
                if (_.isArray(value)) {
                    value = _.map(value, function(v) {
                        return validateAndTransformValue(key, field, v);
                    })
                } else {
                    value = validateAndTransformValue(key, field, value);
                }
                
                if (_.isArray(value) && !queryOperationSupportsValuesArray(op)) {
                    throw new errors.BackeryInvalidParametersError('Operation `' + op + '` does not support array as a parameter');
                }
                
                if (!_.isArray(value) && queryOperationSupportsValuesArray(op)) {
                    value = [value];
                }
                
                if (!fieldSupportsQueryOperation(key, field, op)) {
                    throw new errors.BackeryInvalidParametersError('Key `' + key + '` does not support query operation `' + op + '`');
                }
                
                return [op, _.object([key],[value])];
            }
        }));
    }
    
    return parseWhere(where);
}

EntityDefinition.prototype.prepareSort = function(sort) {
    var self = this;
    _.each(sort, function(pair) {
        var key = _.keys(pair)[0];
        if (pair[key] != "asc" && pair[key] != "desc") {
            throw new errors.BackeryInvalidParametersError('Invalid sort order for key `' + key + '` (' + pair[key] + ')');
        }
        
        var asc = pair[key] == "asc";
        
        // Check key for validity
        var field = self.fields[key];
        if (!field && key != "id" && key != "createdAt" && key != "updatedAt") {
            throw new errors.BackeryInvalidParametersError('Invalid `sort` object, key not found: `' + key + '`');
        }
        
        if (field && !(field.type.isDate() || field.type.isString() || field.type.isInteger() ||
            field.type.isNumber() || field.type.isBoolean())) {
            
            throw new errors.BackeryInvalidParametersError('Key cannot be used for sort: `' + key + '`');
        }
    });
    
    return sort;
}
    
EntityDefinition.User = function() {
    return new EntityDefinition({
        name: EntityDefinition.userEntityName,
        fields: [ ]
    });
}

EntityDefinition.File = function() {
    return new EntityDefinition({
        name: EntityDefinition.fileEntityName,
        fields: []
    });
}

module.exports = EntityDefinition;
