var errors = require('../utils/errors.js');

var BackerQuery = function(entity, impl) {
    var pimpl = impl;
    var that = this;
    
    
    var whereValue;
    this.where = function(where) {
        // TODO: validate
        whereValue = where;
        return that;
    }
    
    this.getWhere = function() {
        return whereValue;
    }
    
    var includeValue;
    this.include = function(include) {
        // TODO: validate
        includeValue = include;
        return that;
    }
    
    this.getInclude = function() {
        return includeValue;
    }
    
    var offsetValue;
    this.offset = function(offset) {
        offsetValue = offset;
        return that;
    }
    
    this.getOffset = function() {
        return offsetValue;
    }
    
    var limitValue;
    this.limit = function(limit) {
        limitValue = limit;
        return that;
    }
    
    this.getLimit = function() {
        return limitValue;
    }
    
    // Finds BackerObjects according to the previosly set up query, returns Backer.Promise
    this.find = function() {
        return pimpl.find(that);
    }
    
    // Counts BackerObjects according to the previosly set up query, returns Backer.Promise
    this.count = function() {
        return pimpl.count(that);
    }
    
    // Counts BackerObjects according to the previosly set up query, returns Backer.Promise
    this.findAndCount = function() {
        if (pimpl.findAndCount)
            return pimpl.findAndCount(that);
        else
            throw new errors.BackerError('findAndCount is not supported by the underlying model');
    }
}

module.exports = BackerQuery;
