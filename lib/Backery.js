var _ = require('underscore');
var Promise = require('promise');
var BackeryCondition = require('./model/classes/BackeryCondition.js');
var Struct = require('./api/BackeryStruct.js');
var Promise = require('promise');
var errors = require('./utils/errors.js');

require('promise/lib/rejection-tracking').enable();

var Backery = module.exports = {
    Promise: Promise,
    Struct: Struct,
    Object: {
        load: function(data, model) {
            var struct;
            if (_.isObject(data['__type']) && _.isString(data['__type']['entity']) && !data['__type']['isCollection']) {
                // load from JSON
                struct = Struct.fromJSON(data);
            } else if (Struct.isStructObject(data)) {
                // load from Backery.Struct
                struct = data;
            } else {
                throw new errors.BackeryInvalidParametersError('Failed to load object: no supported parameters found');
            }
            
            var entity = model.entity(struct.entityName);
            if (!entity) {
                throw new errors.BackeryConsistencyError('Failed to load object: entity `' + struct.entityName + '` not found');
            }
            
            return entity.load(struct);
        }
    },
    
    /// Namespace for errors
    Error: {
        Inconsistency: function(message) {
            Object.defineProperty(this, 'name', { get: function() { return 'BackeryConsistencyError'; } });
            Object.defineProperty(this, 'status', { get: function() { return 422; } });
            Object.defineProperty(this, 'message', { get: function() {
                return message;
            }});
        },
        
        NotFound: function(what, id) {
            Object.defineProperty(this, 'name', { get: function() { return 'BackeryNotFoundError'; } });
            Object.defineProperty(this, 'status', { get: function() { return 404; } });
            Object.defineProperty(this, 'message', { get: function() {
                if (_.isUndefined(id))
                    return what;
                else
                    return what + ' (id: ' + id + ') not found';
            }});
        }
    }
};

_.each(BackeryCondition, function(value, key) {
    Backery[key] = value;
});
