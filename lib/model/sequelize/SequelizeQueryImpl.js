var _ = require('underscore');

var BackeryObject = require('../BackeryObject.js');
var SequelizeObjectImpl = require('./SequelizeObjectImpl.js');

var TypeDefinition = require('../definition/TypeDefinition.js');
var errors = require('../../utils/errors.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeQueryImpl = function(entityDefinition, sequelizeEntityModel, sequelizeModel) {
    this.definition = entityDefinition;
    this.sequelizeEntityModel = sequelizeEntityModel;
    
    this.sequelizeModel = sequelizeModel;
    this.Promise = sequelizeModel.Backery.Promise;
    this.promiseWrap = sequelizeModel.promiseWrap;
    
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
    return self.promiseWrap(self.sequelizeEntityModel.findAll(self._prepareQuery(query, 0, 100)), function(sequelizeInstances) {
        return _.map(sequelizeInstances, function(sequelizeInstance) {
            return new BackeryObject(new SequelizeObjectImpl(sequelizeInstance, self.definition, self.context));
        });
    });
    
    return this._performQuery('findAll', query);
}

SequelizeQueryImpl.prototype.count = function(query) {
    return this.promiseWrap(this.sequelizeEntityModel.count({
        where: query.getWhere()
    }));
}

SequelizeQueryImpl.prototype.findAndCount = function(query) {
    var self = this;
    return self.promiseWrap(self.sequelizeEntityModel.findAndCount(self._prepareQuery(query, 0, 100)), function(result) {
        return {
            count: result.count,
            objects: _.map(result.rows, function(sequelizeInstance) {
                return new BackeryObject(new SequelizeObjectImpl(sequelizeInstance, self.definition, self.context));
            })
        }
    });
}

module.exports = SequelizeQueryImpl;
