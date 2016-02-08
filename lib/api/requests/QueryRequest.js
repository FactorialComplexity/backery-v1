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

var QueryRequest = function(entity, operation, queryData, Backer) {
    var _entity = entity;
    var _queryData = queryData;
    var _validationError;
    var _prepared;
    var _query, _functionName = 'find';
    
    var self = this;
    
    
    function _prepare() {
        if (_prepared)
            throw new Error('Request processing was already prepared');
        
        if (operation == 'find') {
            _functionName = 'find';
        } else if (operation == 'count') {
            _functionName = 'count';
        } else if (operation == 'findAndCount') {
            _functionName = 'findAndCount';
        } else {
            _validationError = new errors.BackerInvalidParametersError('Unsupported query operation `' + operation + '`',
                ['operation']);
        }
        
        if (!_validationError) {
            _query = _entity.query();
            
            if (queryData.where)
                _query.where(queryData.where);
            
            if (queryData.sort)
                _query.sort(queryData.sort);
            
            if (queryData.include)
                _query.include(queryData.include);
            
            if (queryData.offset)
                _query.offset(queryData.offset);
                
            if (queryData.limit)
                _query.limit(queryData.limit);
            
            _prepared = true;
        }
    }
    
    _prepare();
    
    
    this.getValidationError = function() {
        return undefined;
    }
    
    this.getEntity = function() {
        return _entity;
    }
    
    this.getQuery = function() {
        return _query;
    }
    
    this.execute = function() {
        if (_validationError) {
            return Backer.Promise.reject(_validationError);
        } else {
            return _query[_functionName]().then(function(result) {
                if (operation == 'find') {
                    return Backer.Promise.resolve(new QueryResponse(result));
                } else if (operation == 'count') {
                    return Backer.Promise.resolve(new QueryResponse(undefined, result));
                } else if (operation == 'findAndCount') {
                    return Backer.Promise.resolve(new QueryResponse(result.objects, result.count));
                }
            });
        }
    }
}

module.exports = QueryRequest;
