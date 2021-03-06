var _ = require('underscore');

var TypeDefinition = require('../definition/TypeDefinition.js');
var errors = require('../../utils/errors.js');

var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var SequelizeQueryImpl = function(entityDefinition, sequelizeModel, relatedToObject, relatedFieldDefinition) {
    this.definition = entityDefinition;
    this.sequelizeEntityModel = sequelizeModel._sequelizeModels[entityDefinition.name];
    
    this.sequelizeModel = sequelizeModel;
    this.Promise = sequelizeModel.Backery.Promise;
    this.promiseWrap = sequelizeModel.promiseWrap;
    
    this.relatedToObject = relatedToObject;
    this.relatedFieldDefinition = relatedFieldDefinition;
    
    var self = this;
    
    function compactUndefinedValues(object) {
        return _.pick(object, function(value, key, object) {
            return !_.isUndefined(value) && !(_.isArray(value) && value.length == 0);
        });
    }
    
    this._prepareQuery = function(query, defaultOffset, defaultLimit, overrideLimit) {
        var data = compactUndefinedValues({
            where: query ? self.sequelizeModel.transformWhere(entityDefinition, query.getWhere()) : undefined,
            include: query ? self.sequelizeModel.transformInclude(entityDefinition, query.getInclude()) : undefined,
            order: query ? self.sequelizeModel.transformSort(entityDefinition, query.getSort(), query.getInclude()) : undefined,
            offset: query ? (query.getOffset() || defaultOffset) : defaultOffset,
            limit: !_.isUndefined(overrideLimit) ? overrideLimit : (query ? (query.getLimit() || defaultLimit) : defaultLimit),
            having: query ? self.sequelizeModel.transformHaving(entityDefinition, query.getWhere()) : undefined,
            attributes: query ? self.sequelizeModel.transformAttributes(entityDefinition, query.getWhere()) : undefined
        });
        if (data.having && data.having[0].distance) {
            data.order = 'distance'
        }
        return data;
    }
    
    this._prepareQueryCount = function(query) {
        var data = compactUndefinedValues({
            where: query ? self.sequelizeModel.transformWhere(entityDefinition, query.getWhere()) : undefined,
            having: query ? self.sequelizeModel.transformHaving(entityDefinition, query.getWhere()) : undefined,
            attributes: query ? self.sequelizeModel.transformAttributes(entityDefinition, query.getWhere()) : undefined
        });
        return data;
    }
}

/**
 * The definition of entity to be queried. In case of relation query, this is the definition of
 * related entity, not the one for the queried object.
 */
SequelizeQueryImpl.prototype.getEntityDefinition = function() {
    return !this.relatedToObject ? this.definition : this.relatedFieldDefinition.type.relatedEntity;
}

SequelizeQueryImpl.prototype.getRelatedFieldDefinition = function() {
    return this.relatedFieldDefinition;
}

SequelizeQueryImpl.prototype._find = function(query, one) {
    var self = this;
    
    if (self.relatedToObject) {
        return self.promiseWrap(self.relatedToObject.sequelizeInstance
            ['get' + SequelizeNameMapper.sequelizeAssociationAs(self.relatedFieldDefinition)](self._prepareQuery(query, 0, undefined, one ? 1 : undefined))
        ).then(function(sequelizeInstances) {
            if (!one) {
                return self.sequelizeModel.loadBackeryObjects(sequelizeInstances, self.getEntityDefinition());
            } else {
                return sequelizeInstances.length ?
                    self.sequelizeModel.loadBackeryObject(sequelizeInstances[0], self.getEntityDefinition()) :
                    self.Promise.resolve();
            }
        });
        
    } else {
        return self.promiseWrap(self.sequelizeEntityModel.findAll(self._prepareQuery(query, 0, undefined, one ? 1 : undefined))).then(function(sequelizeInstances) {
            if (!one) {
                return self.sequelizeModel.loadBackeryObjects(sequelizeInstances, self.definition);
            } else {
                return sequelizeInstances.length ?
                    self.sequelizeModel.loadBackeryObject(sequelizeInstances[0], self.definition) :
                    self.Promise.resolve();
            }
        });
    }
}

SequelizeQueryImpl.prototype.find = function(query) {
    return this._find(query, false);
}

SequelizeQueryImpl.prototype.findOne = function(query) {
    return this._find(query, true);
}

SequelizeQueryImpl.prototype.count = function(query, group) {
    var self = this;
    
    if (self.relatedToObject) {
        if (group) {
            throw new errors.BackeryUnsupportedError('Grouping in relation queries is not currently supported by SequelizeDatabase');
        }
        
        return self.promiseWrap(self.relatedToObject.sequelizeInstance
            ['count' + SequelizeNameMapper.sequelizeAssociationAs(self.relatedFieldDefinition)](self._prepareQueryCount(query, 0, undefined)));
    } else {
        if (group) {
            var field = self.definition.fields[group];
            if (!field) {
                throw new errors.BackeryInvalidParametersError('Field for group count not found: `' + group + '`');
            }
            
            if (field.type.isRelationMany()) {
                throw new errors.BackeryInvalidParametersError('Cannot group count by many relation: `' + group + '`');
            }
            
            var sequelize = self.sequelizeModel._sequelize;
            var preparedQuery = self._prepareQueryCount(query);
            var columnName = field.type.isRelationOne() ?
                SequelizeNameMapper.sequelizeAssociationForeignKey(field) :
                SequelizeNameMapper.sequelizeFieldName(field);
            preparedQuery.group = columnName;
            preparedQuery.attributes = [
                columnName,
                [sequelize.fn('count', sequelize.col(columnName)), 'count']
            ];
            
            return self.promiseWrap(self.sequelizeEntityModel.findAll(preparedQuery), function(results) {
                return _.map(results, function(result) {
                    if (field.type.isRelationOne()) {
                        var ret = {
                            count: result.get('count')
                        };
                        ret[field.name] = result.get(columnName) ?
                            self.sequelizeModel.entity(field.type.relatedEntity.name).load(result.get(columnName).toString()) :
                            null;
                        return ret;
                    } else {
                        var ret = {};
                        ret[result.get(columnName)] = result.get('count');
                        return ret;
                    }
                });
            });
            
        } else {
            return self.promiseWrap(self.sequelizeEntityModel.count(self._prepareQueryCount(query)));
        }
    }
}

SequelizeQueryImpl.prototype.findAndCount = function(query) {
    var self = this;
    //if (self.relatedToObject) {
        // TODO: smartly do this as a single request
        return self.Promise.all([
            self.count(query),
            self.find(query)
        ]).then(function(results) {
            return self.Promise.resolve({
                count: results[0],
                objects: results[1]
            });
        });
    // } else {
    //     return self.promiseWrap(self.sequelizeEntityModel.findAndCount(self._prepareQuery(query, 0, undefined))).then(function(result) {
    //         return self.sequelizeModel.loadBackeryObjects(result.rows, self.definition).then(function(objects) {
    //             return self.Promise.resolve({
    //                 count: result.count,
    //                 objects: objects
    //             });
    //         });
    //     });
    //}
}

module.exports = SequelizeQueryImpl;
