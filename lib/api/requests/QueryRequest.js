var _ = require('underscore');

var errors = require('../../utils/errors.js');

var QueryRequest = function(query, operation, user, Backery) {
    Object.defineProperty(this, 'type', { get: function() { return 'Query'; } });
    
    var _validationError;
    var _query = query;
    var _functionName = 'find';
    
    var self = this;
    
    if (operation == 'find') {
        _functionName = 'find';
    } else if (operation == 'count') {
        _functionName = 'count';
    } else if (operation == 'findAndCount') {
        _functionName = 'findAndCount';
    } else {
        _validationError = new errors.BackeryInvalidParametersError('Unsupported query operation `' + operation + '`',
            ['operation']);
    }
    
    
    Object.defineProperty(this, 'user', { get: function() { return user; } });
    Object.defineProperty(this, 'query', { get: function() { return _query; } });
    Object.defineProperty(this, 'operation', { get: function() { return _functionName; } });
    Object.defineProperty(this, 'entity', { get: function() { return _query.getEntity(); } });
    
    this.getValidationError = function() {
        return _validationError;
    }
    
    this.execute = function() {
        if (_validationError) {
            return Backery.Promise.reject(_validationError);
        } else {
            return _query[_functionName]().then(function(result) {
                var collection = Backery.Struct.Collection(_query.getEntity().getName());
                collection.setOffsetLimit(_query.getOffset(), _query.getLimit());
                
                if (operation == 'find') {
                    collection.setObjects(_.map(result, function(object) {
                        return object.toStruct();
                    }));
                } else if (operation == 'count') {
                    collection.setCount(result);
                } else if (operation == 'findAndCount') {
                    collection.setObjects(_.map(result.objects, function(object) {
                        return object.toStruct();
                    }));
                    collection.setCount(result.count);
                }
                
                return Backery.Promise.resolve(collection);
            });
        }
    }
}

module.exports = QueryRequest;
