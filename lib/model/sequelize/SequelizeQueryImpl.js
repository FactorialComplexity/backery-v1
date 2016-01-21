var _ = require('underscore');

var BackerObject = require('../BackerObject.js');
var SequelizeObjectImpl = require('./SequelizeObjectImpl.js');

var TypeDefinition = require('../definition/TypeDefinition.js');
var errors = require('../utils/errors.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeQueryImpl = function(entityDefinition, sequelizeModel, promises) {
    this.definition = entityDefinition;
    this.sequelizeModel = sequelizeModel;
    
    this.Promise = promises.class;
    this.promiseWrap = promises.wrap;
    
    var that = this;
    
    this._performQuery = function(methodName, query) {
        var self = that;
    
        var include = _.map(query.getInclude() || [], function(include) {
            if (entityDefinition.fields[include].type.value == TypeDefinition.Relation_One)
                return {
                    model: SequelizeNameMapper.sequelizeModelName(entityDefinition.fields[include].type.relatedEntity),
                    as: SequelizeNameMapper.sequelizeAssociationAs(entityDefinition.fields[include])
                };
            else
                throw new errors.BackerError('Invalid include field `' + include + '`');
        });
    
        return self.promiseWrap(sequelizeModel[methodName]({
            where: query.getWhere(),
            include: include,
            offset: query.getOffset() || 0,
            limit: query.getLimit() || 100 // default limit
        }), function(sequelizeInstances) {
            return _.map(sequelizeInstances, function(sequelizeInstance) {
                return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, promises));
            });
        });
    }
}

SequelizeQueryImpl.prototype.find = function(query) {
    return this._performQuery('findAll', query);
}

SequelizeQueryImpl.prototype.count = function(query) {
    return this.promiseWrap(this.sequelizeModel.count({
        where: query.getWhere()
    }));
}

SequelizeQueryImpl.prototype.findAndCount = function(query) {
    return this._performQuery('findAndCount', query);
}

module.exports = SequelizeQueryImpl;
