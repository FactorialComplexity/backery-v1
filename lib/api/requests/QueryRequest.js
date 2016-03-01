var _ = require('underscore');

var errors = require('../../utils/errors.js');

var QueryResponse = function(objects, count) {
    var _objects = objects;
    var _count = count;
    
    var self = this;
    
    function _responseObject(objects, count) {
        if (count && _.isUndefined(objects)) {
            return count;
        } else if (count && !_.isUndefined(objects)) {
            return {
                _objects: objects,
                _count: count
            };
        } else if (_.isUndefined(count) && !_.isUndefined(objects)) {
            return objects;
        }
    }
    
    this.getObjects = function() {
        return _objects;
    }
    
    /**
     * Returns response object in user's perspective, honoring any access rights that user have.
     * @param user user to use perspective, if undefined the perspective of user who issued the request is used.
     */
    this.getResponseObject = function(user) {
        // TODO: if user is not specified use default user
        
        return _responseObject(!_.isUndefined(_objects) ? _.map(_objects, function(object) {
            return object.toJSON(user);
        }) : undefined, count);
    }
    
    /**
     * Returns response object unrestricted to any user access rights.
     */
    this.getResponseObjectUnrestricted = function() {
        return _responseObject(!_.isUndefined(_objects) ? _.map(_objects, function(object) {
            return object.toJSON();
        }) : undefined, count);
    }
}

var QueryRequest = function(query, operation, user, Backery) {
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
    
    this.getValidationError = function() {
        return _validationError;
    }
    
    this.execute = function() {
        if (_validationError) {
            return Backery.Promise.reject(_validationError);
        } else {
            return _query[_functionName]().then(function(result) {
                if (operation == 'find') {
                    return Backery.Promise.resolve(new QueryResponse(result));
                } else if (operation == 'count') {
                    return Backery.Promise.resolve(new QueryResponse(undefined, result));
                } else if (operation == 'findAndCount') {
                    return Backery.Promise.resolve(new QueryResponse(result.objects, result.count));
                }
            });
        }
    }
}

module.exports = QueryRequest;
