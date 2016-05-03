var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryRelation = function(impl) {
    
    var pimpl = impl;
    var self = this;
    var _operation;
    
    // Returns a basic query that can be further configured for fetching related objects
    // NOTE: object fetched by this query will NOT be returnable via fetched() method
    this.query = function() {
        return pimpl.query();
    }
    
    this.set = function(objects, context) {
        if (!_.isArray(objects)) {
            objects = [objects];
        }

        return !_.isUndefined(objects) ? pimpl.set(objects, context) : pimpl.Promise.resolve();
    }

    this.add = function(objects, context) {
        if (!_.isArray(objects)) {
            objects = [objects];
        }
        
        return objects.length ? pimpl.add(objects, context) : pimpl.Promise.resolve();
    }
    
    this.remove = function(objects, context) {
        if (!_.isArray(objects)) {
            objects = [objects];
        }
        
        return objects.length ? pimpl.remove(objects, context) : pimpl.Promise.resolve();
    }
    
    this.setOperation = function(operation) {
        _operation = operation;
    }
    
    this.getOperation = function() {
        return _operation;
    }
    
    this.applyOperation = function(context) {
        var operation = _operation;
        _operation = undefined;

        var changes = operation.getChanges();
        if (!operation.isEmpty()) {
            if (!_.isUndefined(changes.set))
                return self.set(changes.set, context);

            return pimpl.Promise.all([
                self.add(changes.add, context),
                self.remove(changes.remove, context)
            ]);
        }
        return pimpl.Promise.resolve();
    }
    
    // Shortcut for fetching the object for the relation
    this.fetch = function(limit, offset) {
        return pimpl.fetch(limit, offset);
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
