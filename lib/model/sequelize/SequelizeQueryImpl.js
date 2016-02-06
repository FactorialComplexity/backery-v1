var _ = require('underscore');

var BackerObject = require('../BackerObject.js');
var SequelizeObjectImpl = require('./SequelizeObjectImpl.js');

var TypeDefinition = require('../definition/TypeDefinition.js');
var errors = require('../../utils/errors.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeQueryImpl = function(entityDefinition, sequelizeModel, context) {
    this.definition = entityDefinition;
    this.sequelizeModel = sequelizeModel;
    
    this.context = context;
    this.Promise = context.Promise;
    this.promiseWrap = context.promiseWrap;
    
    var that = this;
    
    this._prepareQuery = function(query, defaultOffset, defaultLimit) {
        var self = that;
        return {
            where: query.getWhere(),
            include: self.context.model.transformInclude(entityDefinition, query.getInclude()),
            order: query.getSort(),
            offset: query.getOffset() || defaultOffset,
            limit: query.getLimit() || defaultLimit
        };
    }
}

SequelizeQueryImpl.prototype.find = function(query) {
    var self = this;
    return self.promiseWrap(self.sequelizeModel.findAll(self._prepareQuery(query, 0, 100)), function(sequelizeInstances) {
        return _.map(sequelizeInstances, function(sequelizeInstance) {
            return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, self.definition, self.context));
        });
    });
    
    return this._performQuery('findAll', query);
}

SequelizeQueryImpl.prototype.count = function(query) {
    return this.promiseWrap(this.sequelizeModel.count({
        where: query.getWhere()
    }));
}

SequelizeQueryImpl.prototype.findAndCount = function(query) {
    var self = this;
    return self.promiseWrap(self.sequelizeModel.findAndCount(self._prepareQuery(query, 0, 100)), function(result) {
        return {
            count: result.count,
            objects: _.map(result.rows, function(sequelizeInstance) {
                return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, self.definition, self.context));
            })
        }
    });
}

module.exports = SequelizeQueryImpl;
