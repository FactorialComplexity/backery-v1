var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryRelationOperation = require('./BackeryRelationOperation.js');

var BackeryEntity = function(definition, impl, Backery) {
    var pimpl = impl;
    var self = this;
    
    // Creates new instance of the entity of BackeryObject type and immediately returns
    this.create = function(values) {
        var object = pimpl.create();
        object.setValues(values);
        return object;
    }
    
    // Fetches an object by id, returns Backery.Promise
    this.get = function(id, include) {
        try {
            include = definition.prepareInclude(include);
        } catch (error) {
            return Backery.Promise.reject(error);
        }
        
        return pimpl.get(id, include);
    }
    
    // Instantly creates and returns an unfetched BackeryObject with specified id and values
    // or the contents of the Backery.Struct.Object. If struct doesn't contain identifier,
    // this does the same as create().
    this.load = function(arg1, arg2) {
        if (_.isString(arg1)) {
            var id = arg1;
            var values = arg2;
            
            var object = pimpl.ref(id);
            if (values) {
                object.setValues(values);
            }
        
            return object;
        } else if (_.isObject(arg1) && _.isString(arg1.entityName)) {
            var struct = arg1;
            
            if (struct.entityName != self.getName()) {
                throw new errors.BackeryConsistencyError('Failed to load object from struct: expected entity `' +
                    self.getName() + '`, but found `' + struct.entityName + '`');
            }
            
            if (!struct.isNull()) {
                var object = struct.objectId ? pimpl.ref(id) : pimpl.create();
                
                _.each(definition.fields, function(field) {
                    var fieldStruct = struct.get(field.name);
                    if (fieldStruct) {
                        if (field.type.isRelation()) {
                            if (field.type.isRelationOne()) {
                                if (fieldStruct.isObject()) {
                                    // TODO: objects pool
                                    object.set(Backery.Model[field.type.relatedEntity.name].load(fieldStruct));
                                } else {
                                    throw new errors.BackeryConsistencyError('Failed to load object from struct: types for `' +
                                        field.name + '` do not match (expected Object, found ' + fieldStruct.type + ')');
                                }
                            } else {
                                // TODO: currently many relations are not being handled in any way
                            }
                        } else {
                            _.find(['Date', 'String', 'Number', 'Integer', 'Boolean', 'Array', 'Dictionary'], function(type) {
                                if (field.type['is' + type]()) {
                                    if (fieldStruct['is' + type]()) {
                                        object.set(field.name, fieldStruct.value);
                                        return true;
                                    } else {
                                        throw new errors.BackeryConsistencyError('Failed to load object from struct: types for `' +
                                            field.name + '` do not match (expected ' + type + ', found ' + fieldStruct.type + ')');
                                    }
                                }
                            });
                        }
                    }
                });
            } else {
                return null;
            }
            
        } else {
            throw new errors.BackeryInvalidParametersError('Failed to load object: no supported parameters found');
        }
    }
    
    // Create new BackeryQuery instance for the entity and immediately returns
    this.query = function() {
        return pimpl.query();
    }
    
    this.getDefinition = function() {
        return definition;
    }
    
    this.getName = function() {
        return definition.name;
    }
    
    this.RelationOperation = {
        Set: function(objects) {
            return BackeryRelationOperation.Set(objects, self);
        },
        
        AddRemove: function(add, remove) {
            return BackeryRelationOperation.Add(add, remove, self);
        },
        
        FromData: function(data) {
            return BackeryRelationOperation.FromData(data, self);
        },
    }
}

module.exports = BackeryEntity;
