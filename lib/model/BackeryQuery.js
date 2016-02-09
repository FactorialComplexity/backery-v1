var errors = require('../utils/errors.js');

var BackeryQuery = function(entity, impl, Backery) {
    var pimpl = impl;
    
    var self = this;
    self.Backery = Backery;
    
    var whereValue;
    
    /**
     * Replaces where condition with one specified in where parameter.
     */
    this.where = function(where) {
        // TODO: validate
        whereValue = where;
        return self;
    }
    
    this.and = function(andWhere) {
        whereValue = self.Backery.And(whereValue, andWhere);
    }
    
    this.or = function(orWhere) {
        whereValue = self.Backery.Or(whereValue, andWhere);
    }
    
    /**
     * Return current where condition.
     */
    this.getWhere = function() {
        return whereValue;
    }
    
    var includeValue;
    this.include = function(include) {
        // TODO: validate
        includeValue = include;
        return self;
    }
    
    this.getInclude = function() {
        return includeValue;
    }
    
    var offsetValue;
    this.offset = function(offset) {
        offsetValue = offset;
        return self;
    }
    
    this.getOffset = function() {
        return offsetValue;
    }
    
    var limitValue;
    this.limit = function(limit) {
        limitValue = limit;
        return self;
    }
    
    this.getLimit = function() {
        return limitValue;
    }
    
    var sortValue;
    this.sort = function(sort) {
        sortValue = sort;
        return self;
    }
    
    this.getSort = function() {
        return sortValue;
    }
    
    // Finds BackeryObjects according to the previosly set up query, returns Backery.Promise
    this.find = function() {
        return pimpl.find(self);
    }
    
    // Counts BackeryObjects according to the previosly set up query, returns Backery.Promise
    this.count = function() {
        return pimpl.count(self);
    }
    
    // Counts BackeryObjects according to the previosly set up query, returns Backery.Promise
    this.findAndCount = function() {
        if (pimpl.findAndCount)
            return pimpl.findAndCount(self);
        else
            throw new errors.BackerError('findAndCount is not supported by the underlying model');
    }
}

module.exports = BackeryQuery;
