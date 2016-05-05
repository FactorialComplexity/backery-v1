var _ = require('underscore');

var errors = require('../utils/errors.js');

var BackeryQuery = function(impl, Backery) {
    var pimpl = impl;
    
    var self = this;
    self.Backery = Backery;
    
    var entityDefinition = impl.getEntityDefinition();
    
    var whereValue;
    
    /**
     * Replaces where condition with one specified in where parameter.
     */
    this.where = function(where) {
        if (arguments.length == 2) {
            where = Backery.Eq(arguments[0], arguments[1]);
        }
        
        whereValue = entityDefinition.prepareWhere(where, Backery.Model);
        return self;
    }
    
    this.and = function(andWhere) {
        if (arguments.length == 2) {
            andWhere = Backery.Eq(arguments[0], arguments[1]);
        }
        
        self.where(self.Backery.And(whereValue, andWhere));
        return self;
    }
    
    this.or = function(orWhere) {
        if (arguments.length == 2) {
            orWhere = Backery.Eq(arguments[0], arguments[1]);
        }
        
        self.where(self.Backery.Or(whereValue, orWhere));
        return self;
    }
    
    this.getEntity = function() {
        return Backery.Model[entityDefinition.name];
    }
    
    /**
     * Return current where condition.
     */
    this.getWhere = function() {
        return _.clone(whereValue);
    }
    
    var includeValue;
    this.include = function(include, includeFiles) {
        includeValue = entityDefinition.prepareInclude(include, includeFiles);
        return self;
    }
    
    this.getInclude = function() {
        return _.clone(includeValue);
    }
    
    var sortValue;
    this.sort = function(sort) {
        sortValue = entityDefinition.prepareSort(sort);
        return self;
    }
    
    this.getSort = function() {
        return _.clone(sortValue);
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
    
    
    // Finds BackeryObjects according to the previosly set up query, returns Backery.Promise
    this.find = function() {
        return pimpl.find(self);
    }
    
    this.findOne = function() {
        return pimpl.findOne(self);
    }
    
    // Counts BackeryObjects according to the previosly set up query, returns Backery.Promise
    this.count = function(group) {
        return pimpl.count(self, group);
    }
    
    // Counts BackeryObjects according to the previosly set up query, returns Backery.Promise
    this.findAndCount = function() {
        if (pimpl.findAndCount)
            return pimpl.findAndCount(self);
        else
            throw new errors.BackeryUnsupportedError('findAndCount is not supported by the underlying model');
    }
}

module.exports = BackeryQuery;
