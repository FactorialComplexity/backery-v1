var _ = require('underscore');
var errors = require('../utils/errors.js');
var BackeryRelationOperation = require('./BackeryRelationOperation.js');

var BackeryRelation = function(impl, sourceObject) {
    
    var pimpl = impl;
    var self = this;
    var _operation;
    
    Object.defineProperty(this, 'sourceObject', {
        get: function() {
            return sourceObject;
        }
    });
    
    // Returns a basic query that can be further configured for fetching related objects
    // NOTE: object fetched by this query will NOT be returnable via fetched() method
    this.query = function() {
        return pimpl.query(sourceObject);
    }
    
    this.set = function(objects) {
        _operation = BackeryRelationOperation.Set(objects, pimpl.relatedEntity());
        return self;
    }

    this.add = function(objects) {
        if (!_.isArray(objects)) {
            objects = [objects];
        }
        
        var changes = _operation ? _operation.getChanges() : {};
        
        if (changes.set) {
            throw new errors.BackeryInvalidParametersError(
                'Cannot add objects on top of previous `set` operation. Save or revert changes first.');
        }
        
        _operation = BackeryRelationOperation.AddRemove(_.union(changes.add, objects), changes.remove,
                pimpl.relatedEntity());
        return self;
    }
    
    this.remove = function(objects) {
        if (!_.isArray(objects)) {
            objects = [objects];
        }
        
        var changes = _operation ? _operation.getChanges() : {};
        
        if (changes.set) {
            throw new errors.BackeryInvalidParametersError(
                'Cannot remove objects on top of previous `set` operation. Save or revert changes first.');
        }
        
        _operation = BackeryRelationOperation.AddRemove(changes.add, _.union(changes.remove, objects),
                pimpl.relatedEntity());
        return self;
    }
    
    this.setOperation = function(operation) {
        _operation = operation;
    }
    
    this.getOperation = function() {
        return _operation;
    }
    
    // Shortcut for fetching the object for the relation
    this.fetch = function(limit, offset) {
        return pimpl.fetch(limit, offset);
    }
    
    // Shortcut for counting objects for the relation
    this.count = function(limit, offset) {
        return self.query(sourceObject).limit(limit).offset(offset).count();
    }
    
    // Returns the list of BackeryObject, which were a result of the latest fetch or include
    this.fetched = function() {
        return pimpl.fetched();
    }
    
    // Returns the offset of the latest fetch or include
    this.offset = function() {
        return pimpl.offset();
    }

    // Returns the limit of the latest fetch or include
    this.limit = function() {
        return pimpl.limit();
    }
}

module.exports = BackeryRelation;
