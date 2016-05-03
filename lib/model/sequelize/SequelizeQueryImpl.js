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
            return !_.isUndefined(value);
        });
    }
    
    this._prepareQuery = function(query, defaultOffset, defaultLimit, overrideLimit) {
        var data = compactUndefinedValues({
            where: query ? self.sequelizeModel.transformWhere(entityDefinition, query.getWhere()) : undefined,
            include: query ? self.sequelizeModel.transformInclude(entityDefinition, query.getInclude()) : undefined,
            order: query ? self.sequelizeModel.transformSort(entityDefinition, query.getSort()) : undefined,
            offset: query ? (query.getOffset() || defaultOffset) : defaultOffset,
            limit: !_.isUndefined(overrideLimit) ? overrideLimit : (query ? (query.getLimit() || defaultLimit) : defaultLimit)
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

SequelizeQueryImpl.prototype._find = function(query, one) {
    var self = this;
    
    if (self.relatedToObject) {
        return self.promiseWrap(self.relatedToObject.sequelizeInstance
                ['get' + SequelizeNameMapper.sequelizeAssociationAs(self.relatedFieldDefinition)](self._prepareQuery(query, 0, undefined, one ? 1 : undefined)),
            function(sequelizeInstances) {
                if (!one) {
                    return _.map(sequelizeInstances, function(sequelizeInstance) {
                        return self.sequelizeModel.createBackeryObject(sequelizeInstance, self.getEntityDefinition());
                    });
                } else {
                    return sequelizeInstances.length ?
                        self.sequelizeModel.createBackeryObject(sequelizeInstances[0], self.getEntityDefinition()) :
                        undefined;
                }
            }
        );
        
    } else {
        return self.promiseWrap(self.sequelizeEntityModel.findAll(self._prepareQuery(query, 0, undefined, one ? 1 : undefined)), function(sequelizeInstances) {
            if (!one) {
                return _.map(sequelizeInstances, function(sequelizeInstance) {
                    return self.sequelizeModel.createBackeryObject(sequelizeInstance, self.definition);
                });
            } else {
                return sequelizeInstances.length ?
                    self.sequelizeModel.createBackeryObject(sequelizeInstances[0], self.definition) :
                    undefined;
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

SequelizeQueryImpl.prototype.count = function(query) {
    var self = this;
    
    if (self.relatedToObject) {
        return self.promiseWrap(self.relatedToObject.sequelizeInstance
            ['count' + SequelizeNameMapper.sequelizeAssociationAs(self.relatedFieldDefinition)](self._prepareQuery(query, 0, undefined)));
    } else {
        return self.promiseWrap(self.sequelizeEntityModel.count(self._prepareQuery(query)));
    }
}

SequelizeQueryImpl.prototype.findAndCount = function(query) {
    var self = this;
    if (self.relatedToObject) {
        // TODO: smartly do this as a single request
        return self.Promise.all([
            self.count(),
            self.find(query)
        ]).then(function(results) {
            return self.Promise.resolve({
                count: results[0],
                objects: results[1]
            });
        });
    } else {
        return self.promiseWrap(self.sequelizeEntityModel.findAndCount(self._prepareQuery(query, 0, undefined)), function(result) {
            return {
                count: result.count,
                objects: _.map(result.rows, function(sequelizeInstance) {
                    return self.sequelizeModel.createBackeryObject(sequelizeInstance, self.definition);
                })
            }
        });
    }
}

module.exports = SequelizeQueryImpl;
