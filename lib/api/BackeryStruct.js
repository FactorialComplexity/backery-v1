var util = require('util');
var _ = require('underscore');
var errors = require('../utils/errors.js');
var parse = require('../utils/parse.js');

var structs = module.exports = {};

var BackeryStruct = function(type) {
    Object.defineProperty(this, 'type', { get: function() { return type; } });
};

structs.isStruct = function(value) {
    return _.isString(value.type) && _.isFunction(value.toJSON);
}

structs.isStructObject = function(value) {
    return value.type === 'Object' && _.isFunction(value.toJSON);
}

function defineSimpleStruct(options) {
    var BackeryStructType = function(value) {
        BackeryStruct.apply(this, [options.type]);
    
        if (options.validate) {
            options.validate(value);
        }
        
        if (options.construct) {
            options.construct(this, value);
        }
        
        if (options.getValue) {
            Object.defineProperty(this, 'value', { get: function() { return options.getValue(value); } });
        } else if (!options.excludeValueProperty) {
            Object.defineProperty(this, 'value', { get: function() { return value; } });
        }

        this.toJSON = function(verbose) {
            return options.toJSON(verbose, this);
        }
    }
    
    BackeryStruct.prototype['is' + options.type] = function() {
        return this.type === options.type;
    }
    
    util.inherits(BackeryStructType, BackeryStruct);
    structs[options.type] = function(value) {
        return new BackeryStructType(value);
    }
    
    structs[options.type].fromJSON = function(json) {
        if (json['__type'] != options.type) {
            throw new errors.BackeryTypeError('Invalid struct type `' + json['__type'] + '`, expected `' + options.type + '`');
        }
        
        return new BackeryStructType(options.valueFromJSON(json['value']));
    }
    
    structs[options.type].wrap = function(value) {
        if (structs.isStruct(value) && value.type === options.type && !_.isUndefined(value.value)) {
            // looks like it is a struct already
            return value;
        }
        
        return new BackeryStructType(value);
    }
}


// String
defineSimpleStruct({
    type: 'String',

    validate: function(value) {
        if (!_.isString(value) && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a string');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "String", value: self.value } : self.value;
    },
    
    valueFromJSON: function(value) {
        if (!_.isString(value) && !_.isNull(value))
            new errors.BackeryTypeError('Value is not a string');
            
        return value;
    }
});


// Number
defineSimpleStruct({
    type: 'Number',

    validate: function(value) {
        if (!_.isNumber(value) && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a number');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Number", value: self.value } : self.value;
    },
    
    valueFromJSON: function(value) {
        var parsed = parse.parseFloat(value);
        if (_.isNaN(cvalue) && !_.isNull(value))
            new errors.BackeryTypeError('Value is not a number');
            
        return cvalue;
    }
});


// Integer
defineSimpleStruct({
    type: 'Integer',

    validate: function(value) {
        if (!_.isNumber(value) && !_.isFinite(value) && !_.isNull(value) && !Number.isInteger(value)) {
            throw new errors.BackeryTypeError('Value is not an integer');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Integer", value: self.value } : self.value;
    },
    
    valueFromJSON: function(value) {
        var parsed = parse.parseInt(value);
        if (_.isNaN(cvalue) && !_.isNull(value))
            new errors.BackeryTypeError('Value is not an integer');
            
        return cvalue;
    }
});


// Boolean
defineSimpleStruct({
    type: 'Boolean',

    validate: function(value) {
        if (!_.isBoolean(value) && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a boolean');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Boolean", value: self.value } : self.value;
    },
    
    valueFromJSON: function(value) {
        if (!_.isBoolean(value) && !_.isNull(value))
            new errors.BackeryTypeError('Value is not a boolean');
            
        return value;
    }
});

// Date
defineSimpleStruct({
    type: 'Date',

    validate: function(value) {
        if (!_.isDate(value) && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a Date');
        }
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Date", value: self.value ? self.value.toJSON() : null } :
            (self.value ? self.value.toJSON() : null);
    },
    
    valueFromJSON: function(value) {
        var cvalue = parse.parseISODate(value);
    
        if (!cvalue && !_.isNull(value)) {
            throw new errors.BackeryTypeError('Value is not a date in supported format');
        }
        
        return _.isNull(value) ? null : cvalue;
    }
});

// Dictionary
defineSimpleStruct({
    type: 'Dictionary',

    validate: function(value) {
        if ( !_.isObject(value) && !_.isNull(value))
            throw new errors.BackeryTypeError('Value is not an Object');
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Dictionary", value: self.value } : self.value;
    },
    
    valueFromJSON: function(value) {
        if (!_.isObject(value) && !_.isNull(value))
            new errors.BackeryTypeError('Value is not a dictionary');
            
        return value;
    }
});

// Array
defineSimpleStruct({
    type: 'Array',

    validate: function(value) {
        if ( !_.isArray(value) && !_.isNull(value))
            throw new errors.BackeryTypeError('Value is not an Array');
    },

    toJSON: function(verbose, self) {
        return verbose ? { __type: "Array", value: self.value } : self.value;
    },
    
    valueFromJSON: function(value) {
        if (!_.isArray(value) && !_.isNull(value))
            new errors.BackeryTypeError('Value is not an array');
            
        return value;
    }
});

// Object
var BackeryStructObject = function(entityName, objectId, isRef) {
    BackeryStruct.apply(this, ['Object']);
    
    var _fields = { };
    var _objectId = objectId;
    var _createdAt, _updatedAt;
    
    this.keys = function() {
        return _.keys(_fields);
    }
    
    this.set = function(key, value) {
        if (_.isNull(_objectId)) {
            throw new errors.BackeryConsistencyError('Object is null and cannot have any values attached');
        }
        
        if (_.isString(value)) {
            _fields[key] = new structs.String(value);
        } else if (_.isDate(value)) {
            _fields[key] = new structs.Date(value);
        } else if (_.isBoolean(value)) {
            _fields[key] = new structs.Boolean(value);
        } else {
            if (!structs.isStruct(value)) {
                throw new errors.BackeryTypeError('Cannot set value which is not a struct');
            }
            
            _fields[key] = value;
        }
    }
    
    Object.defineProperty(this, 'objectId', { get: function() { return _objectId; } });
    Object.defineProperty(this, 'entityName', { get: function() { return entityName; } });
    
    Object.defineProperty(this, 'createdAt', {
        get: function() { return _createdAt.value; },
        set: function(value) { _createdAt = structs.Date.wrap(value); }
    });
    
    Object.defineProperty(this, 'updatedAt', {
        get: function() { return _updatedAt.value; },
        set: function(value) { _updatedAt = structs.Date.wrap(value); }
    });
    
    this.get = function(key) {
        return _fields[key];
    }
    
    this.unset = function(key) {
        delete _fields[key];
    }
    
    this.isNotFetched = function() {
        return isRef;
    }
    
    this.isNotSaved = function() {
        return _.isUndefined(_objectId);
    }

    this.isNull = function() {
        return _.isNull(_objectId);
    }

    this.toJSON = function(verbose) {
        var self = this;
        var json = _objectId ? {
            id: _objectId
        } : { };

        if (verbose) {
            json['__type'] = { entity: entityName };
        }

        if (_.isNull(_objectId)) {
            if (verbose) {
                json._isNull = true;
            } else {
                return null;
            }
        } else {
            if (!_objectId) {
                if (verbose) {
                    json._isNotSaved = true;
                }
            }
            
            if (_objectId && isRef) {
                if (verbose) {
                    json._isNotFetched = true;
                }
            } else {
                _.each(self.keys(), function(key) {
                    json[key] = self.get(key).toJSON(verbose);
                });
            
                if (_createdAt) {
                    json.createdAt = _createdAt.toJSON(verbose);
                }
            
                if (_updatedAt) {
                    json.updatedAt = _updatedAt.toJSON(verbose);
                }   
            }
        }
        
        return json;
    }
}

BackeryStructObject.fromJSON = function(json) {
    var entityName = json['__type']['entity'];
    var objectId = json['id'];
    var isRef = json['_isNotFetched'] === true;
    
    if (json['_isNull'] === true) {
        objectId = null;
    }
    
    var struct = new BackeryStructObject(entityName, objectId, isRef);
    
    if (!struct.isNull()) {
        // keys
        _.each(json, function(value, key) {
            if (key != '__type' && key != 'id' &&
                key != '_isNotFetched' && key != '_isNotSaved') {
                
                try {
                    struct.set(key, structs.fromJSON(value));
                } catch (error) {
                    throw new errors.BackeryInvalidParametersError(error.message + ' (for key: `' + key + '`)');
                }
            }
        });
    }
    
    return struct;
}

util.inherits(BackeryStructObject, BackeryStruct);
structs.Object = function(entityName, objectId, isRef) {
    return new BackeryStructObject(entityName, objectId, isRef);
}


// Collection
var BackeryStructCollection = function(entityName, objects, count, offset, limit) {
    BackeryStruct.apply(this, ['Collection']);

    var _objects;
    var _count, _offset, _limit;

    Object.defineProperty(this, 'objects', { get: function() { return _objects; } });

    this.setObjects = function(objects) {
        _.each(objects, function(object) {
            if (!structs.isStructObject(object)) {
                throw new errors.BackeryTypeError('Only object structs can be contained in the collection');
            }
        });

        _objects = objects;
    }

    this.append = function(object) {
        if (!structs.isStructObject(object)) {
            throw new errors.BackeryTypeError('Only object structs can be appended to the collection');
        }

        _objects.push(object);
    }

    this.setCount = function(count) {
        _count = count;
    }

    this.setOffsetLimit = function(offset, limit) {
        _offset = offset;
        _limit = limit;
    }


    this.setObjects(objects);
    this.setCount(count);
    this.setOffsetLimit(offset, limit);


    this.toJSON = function(verbose) {
        var self = this;

        if (verbose) {
            var json = {
                __type: {
                    entity: entityName,
                    isCollection: true
                }
            };

            json._objects = _objects ? _.map(_objects, function(object) {
                return object.toJSON(verbose);
            }) : undefined;

            if (!_objects) {
                json._isNotFetched = true;
            }

            if (!_.isUndefined(_count)) {
                json._count = _count;
            }

            if (!_.isUndefined(_offset)) {
                json._offset = _offset;
            }

            if (!_.isUndefined(_limit)) {
                json._limit = _limit;
            }

            return json;
        } else {
            var objects = _.map(_objects, function(object) {
                return object.toJSON(verbose);
            });

            if (!_.isUndefined(_count) && _.isUndefined(_objects)) {
                return _count;
            } else if (!_.isUndefined(_count) && !_.isUndefined(_objects)) {
                var json = {
                    _objects: objects,
                    _count: _count
                };

                if (!_.isUndefined(_offset)) {
                    json._offset = _offset;
                }

                if (!_.isUndefined(_limit)) {
                    json._limit = _limit;
                }

                return json;
            } else if (_.isUndefined(_count) && !_.isUndefined(_objects)) {
                return objects;
            }
        }
    }
}

BackeryStructCollection.fromJSON = function(json) {
    var entityName = json['__type']['entity'];
    var isNotFetched = json['_isNotFetched'] === true;
    var count = json['_count'];
    var limit = json['_limit'];
    var offset = json['_offset'];
    
    var objects = _.isArray(json['_objects']) ? _.map(json['_objects'], function(objectJSON) {
        return structs.fromJSON(objectJSON);
    }) : undefined;
    
    return new BackeryStructCollection(entityName, objects, count, offset, limit);
}

util.inherits(BackeryStructCollection, BackeryStruct);
structs.Collection = function(entityName, objectId) {
    return new BackeryStructCollection(entityName, objectId);
}


/// Deserializes any verbose struct from JSON or Backery.Struct.Object from plain JSON.
/// Plain serialization requires a valid entityName.
/// Method throws if deserializination failed for some reason.
structs.fromJSON = function(json, entityName, model) {
    if (!json)
        return json;
    
    var Backery = model.Backery;
    
    if (_.isObject(json['__type'])) {
        if (_.isString(json['__type']['entity'])) {
            var isCollection = json['__type']['isCollection'] === true;
            if (!isCollection) {
                return BackeryStructObject.fromJSON(json);
            } else {
                return BackeryStructCollection.fromJSON(json);
            }
        } else {
            throw new errors.BackeryInvalidParametersError('Struct deserialization failed: missing __type.entity');
        }
    } else if (_.isString(json['__type'])) {
        var StructObject = structs[json['__type']];
        if (!StructObject) {
            throw new errors.BackeryInvalidParametersError('Struct deserialization failed: unsupported __type `' + json['__type'] + '`');
        }
        
        try {
            return StructObject.fromJSON(json);
        } catch (error) {
            throw new errors.BackeryInvalidParametersError('Struct deserialization failed: ' + error.message);
        }
    } else {
        throw new errors.BackeryUnsupportedError('Deserializing non-verbose Objects is not supported yet');
        //throw new errors.BackeryInvalidParametersError('Struct deserialization failed: unknown __type in JSON');
    }
}

/// Traverses JSON Object or Array and returns new object with any occurence of 
/// serialized verbose BackeryObject deserialized into BackeryStruct.Object in-place.
structs.deserializeVerboseObjectsInJSON = function(json, allowDeserialize) {
    if (_.isObject(json)) {
        if (allowDeserialize) {
            if (_.isObject(json['__type']) && _.isString(json['__type']['entity']) &&
                (_.isString(json['id']) || json['_isNotSaved'] === true)) {
        
                // dictionary seems to contain verbose Backery object
                try {
                    return structs.fromJSON(json, undefined, model);
                } catch (error) {
                    // failed to deserialize - ignore and proceed as with regular dictionary
                }
            }
        }
        
        var ret = { };
        _.each(json, function(value, key) {
            if (_.isObject(value) || _.isArray(value)) {
                ret[key] = structs.deserializeVerboseObjectsInJSON(value, true);
            } else {
                ret[key] = value;
            }
        });
        return ret;
    } else if (_.isArray(json)) {
        return _.map(function(value) {
            if (_.isObject(value) || _.isArray(value)) {
                return structs.deserializeVerboseObjectsInJSON(value, true);
            } else {
                return value;
            }
        });
    }
}
