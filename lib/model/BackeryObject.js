var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryObject = function(impl, isRef) {
    //this.isRef = isRef;
    
    var pimpl = impl;
    var self = this;
    
    function validateKeyExists(key) {
        var definition = pimpl.getEntityDefinition();
        var fieldDefinition = definition.fields[key];
        if (!fieldDefinition)
            throw new errors.BackeryError('Unknown key `' + key + '` on entity `' + definition.name + '`');
    }
    
    // this._applySetRelation = function(onPimpl, fieldDefinition) {
    //     return pimpl._applySetRelation(onPimpl, fieldDefinition);
    // }
    
    this.entityName = function() {
        return pimpl.getEntityDefinition().name;
    }
    
    this.objectId = function() {
        return pimpl.objectId();
    }
    
    this.toJSON = function(user, options) {
        var definition = pimpl.getEntityDefinition();
        
        var preparedInclude = options && _.isArray(options.include) ?
            pimpl.getEntityDefinition().prepareInclude(options.include) : undefined;
        var shouldInclude = options && _.isBoolean(options.include) ?
            options.include : true;
        
        return _.extend({ id: pimpl.objectId() }, _.extend(_.object(_.compact(_.map(definition.fields, function(field) {
            if (field.type.isRelation()) {
                var includeField = shouldInclude && (!preparedInclude || _.find(preparedInclude,
                    function(inc) { inc.field == field.name; }))
                if (includeField) {
                    if (field.type.isRelationMany()) {
                        var relation = self.relation(field.name);
                        if (relation.fetched()) {
                            var result = relation.fetched();
                            if (!_.isUndefined(relation.offset()) || !_.isUndefined(relation.limit())) {
                                result = {
                                    _objects: result,
                                    _offset: relation.offset(),
                                    _limit: relation.limit()
                                };
                            }
                            return [field.name, result];
                        }
                    } else if (field.type.isRelationOne()) {
                        var result = pimpl.get(field.name);
                        if (result) {
                            return [field.name, result.toJSON(user)];
                        } else if (_.isNull(result)) {
                            return [field.name, result];
                        }
                    }
                }
            } else {
                var value = pimpl.get(field.name);
                if (!_.isUndefined(value)) {
                    // TODO: check access 
                    
                    if (field.type.isDate() && value) {
                        value = value.toISOString();
                    } else if (field.type.isFile() && value) {
                        value = value.toJSON();
                    }
                    
                    if (value || _.isBoolean(value))
                        return [field.name, value];
                }
            }
        }))), {
            createdAt: pimpl.getCreatedAt() ? pimpl.getCreatedAt().toJSON() : undefined,
            updatedAt: pimpl.getCreatedAt() ? pimpl.getUpdatedAt().toJSON() : undefined
        }));
    }
    
    // Returns the current value of the specified key
    this.get = function(key) {
        validateKeyExists(key);
        return pimpl.get(key);
    }
    
    this.getCreatedAt = function() {
        return pimpl.getCreatedAt();
    }
    
    this.getUpdatedAt = function() {
        return pimpl.getUpdatedAt();
    }
    
    // Returns the current value of the specified key
    this.relation = function(key) {
        validateKeyExists(key);
        return pimpl.relation(key);
    }
    
    // Sets value for a specified key
    this.set = function(key, value) {
        validateKeyExists(key);
        return pimpl.set(key, value);
    }
    
    // Set multiple values from key/value object
    this.setValues = function(values) {
        var definition = pimpl.getEntityDefinition();
        var prepared = definition.prepareValues(values, pimpl.getAllEntities());
        var object = pimpl.setValues(prepared);
        
        _.map(definition.fields, function(fieldDefinition) {
            if (fieldDefinition.type.isRelationMany() && values[fieldDefinition.name]) {
                self.relation(fieldDefinition.name).setOperation(prepared[fieldDefinition.name]);
            }
        });
    }
    
    // Returns true if object was never saved to persistent storage
    this.isNew = function() {
        return pimpl.isNew();
    }
    
    // Returns true if object doesn't contain any data
    this.isFetched = function() {
        return pimpl.isFetched();
    }
    
    // Fetches object data from the perstistent storage, discarding any updates made to the object.
    // Returns Backery.Promise
    this.fetch = function() {
        return pimpl.fetch(self);
    }
    
    // Fetches object data from the perstistent storage, discarding any updates made to the object.
    // Returns Backery.Promise
    this.save = function() {
        return pimpl.save(self);
    }
    
    // Returns true if value for the key was changed but was not persisted in the database yet
    this.changed = function(key) {
        validateKeyExists(key);
        return pimpl.changed(key);
    }
    
    // Deletes the object from the resistent storage. Returns Backery.Promise
    this.destroy = function() {
        return pimpl.destroy();
    }
}

module.exports = BackeryObject;
