var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackerRelation = function(impl) {
    
    var pimpl = impl;
    var that = this;
    var _operation;
    
    // Returns a basic query that can be further configured for fetching related objects
    // NOTE: object fetched by this query will NOT be returnable via fetched() method
    this.query = function() {
        return pimpl.query();
    }
    
    this.set = function(objects) {
        if (!_.isArray(objects)) {
            objects = [objects];
        }
        
        return pimpl.set(objects);
    }

    this.add = function(objects) {
        if (!_.isArray(objects)) {
            objects = [objects];
        }
        
        return pimpl.add(objects);
    }
    
    this.remove = function(objects) {
        if (!_.isArray(objects)) {
            objects = [objects];
        }
        
        return pimpl.remove(objects);
    }
    
    this.setOperation = function(operation) {
        _operation = operation;
    }
    
    this.getOperation = function() {
        return _operation;
    }
    
    this.applyOperation = function() {
        var operation = _operation;
        _operation = undefined;
        
        if (operation.getType() == 'set') {
            return this.set(operation.getObjects());
        } else if (operation.getType() == 'add') {
            return this.add(operation.getObjects());
        } else if (operation.getType() == 'remove') {
            return this.remove(operation.remove());
        }
        
        return pimpl.Promise.resolve();
    }
    
    // Shortcut for fetching the object for the relation
    this.fetch = function(limit, offset) {
        return pimpl.fetch(limit, offset);
    }
    
    // Returns the list of BackerObject, which were a result of the latest fetch or include
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

module.exports = BackerRelation;
