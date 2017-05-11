var _ = require('underscore');

var BackeryQuery = require('../BackeryQuery.js');

var SequelizeQueryImpl = require('./SequelizeQueryImpl.js');
var SequelizeNameMapper = require('./SequelizeNameMapper.js');

var errors = require('../../utils/errors.js');

var SequelizeRelationImpl = function(objectImpl, fieldDefinition, sequelizeModel) {
    this.definition = fieldDefinition;
    this.objectImpl = objectImpl;
    
    this.sequelizeModel = sequelizeModel;
    this.Promise = sequelizeModel.Backery.Promise;
    this.promiseWrap = sequelizeModel.promiseWrap;
}

SequelizeRelationImpl.prototype.relatedEntity = function() {
    return this.sequelizeModel.entity(this.definition.type.relatedEntity.name);
}

SequelizeRelationImpl.prototype.reloadFetched = function(include, afterFetchCallbackInstaller) {
    var self = this;
    
    var eagerLoaded = self.objectImpl.sequelizeInstance[SequelizeNameMapper.sequelizeAssociationAs(self.definition)];
    if (eagerLoaded) {
        var objectGroup0 = {
            entityDefinition: self.definition.type.relatedEntity,
            objects: [],
            include: include
        };
        self._objectGroupsForCascadeFetch = [objectGroup0];
    
        self._fetched = _.map(eagerLoaded, function(sequelizeInstance) {
            var prepared = self.sequelizeModel.prepareBackeryObjectForFetching(sequelizeInstance, self.definition.type.relatedEntity,
                include, afterFetchCallbackInstaller);
            
            objectGroup0.objects.push(prepared.object);
            self._objectGroupsForCascadeFetch.push.apply(self._objectGroupsForCascadeFetch,
                prepared.impl.getObjectGroupsForCascadeFetch());
            return prepared.object;
        });
    } else {
        self._objectGroupsForCascadeFetch = [];
        self._fetched = undefined;
    }
    
    var fieldInclude = _.find(include, function(inc) { return inc.field == self.definition.name; });
    self._offset = fieldInclude ? fieldInclude.offset : undefined;
    self._limit = fieldInclude ? fieldInclude.limit : undefined;
}

SequelizeRelationImpl.prototype.getObjectGroupsForCascadeFetch = function() {
    return this._objectGroupsForCascadeFetch;
}

SequelizeRelationImpl.prototype.query = function(sourceObject) {
    return new BackeryQuery(new SequelizeQueryImpl(this.definition.type.relatedEntity, this.sequelizeModel,
        this.objectImpl, this.definition), sourceObject, this.sequelizeModel.Backery);
}

SequelizeRelationImpl.prototype._addOrSet = function(method, objects, transaction) {
    var self = this;
    
    var keys = _.uniq(_.map(objects, function(object) {
        if (!object.objectId()) {
            throw new errors.errors.BackeryConsistencyError('Object should be saved before adding to relation');
        }
        
        return parseInt(object.objectId());
    }));
    
    return self.promiseWrap(self.objectImpl.sequelizeInstance[method +
        SequelizeNameMapper.sequelizeAssociationAs(self.definition)](keys, transaction ? { transaction: transaction } : undefined));
}

SequelizeRelationImpl.prototype.add = function(objects, context) {
    if (_.isUndefined(objects)) {
        return this.sequelizeModel.Backery.Promise.resolve();
    }
    
    return this._addOrSet('add', objects, context);
}

SequelizeRelationImpl.prototype.set = function(objects, context) {
    if (_.isUndefined(objects)) {
        return this.sequelizeModel.Backery.Promise.resolve();
    }
    
    return this._addOrSet('set', objects, context);
}

SequelizeRelationImpl.prototype.remove = function(objects, context) {
    if (_.isUndefined(objects)) {
        return this.sequelizeModel.Backery.Promise.resolve();
    }
    
    var self = this;
    
    var keys = _.map(objects, function(object) {
        if (!object.objectId()) {
            throw new errors.errors.BackeryConsistencyError('Object was not saved and cannot be removed from relation');
        }
        
        return parseInt(object.objectId());
    });
    
    return self.promiseWrap(self.objectImpl.sequelizeInstance['remove' +
        SequelizeNameMapper.sequelizeAssociationAs(self.definition)](keys, context ? { transaction: context } : undefined));
}

SequelizeRelationImpl.prototype.applyOperation = function(operation, transaction) {
    var self = this;
    
    var changes = operation.getChanges();
    if (!operation.isEmpty()) {
        if (!_.isUndefined(changes.set))
            return self.set(changes.set, transaction);

        return self.sequelizeModel.Backery.Promise.all([
            self.add(changes.add, transaction),
            self.remove(changes.remove, transaction)
        ]);
    }
    return self.sequelizeModel.Backery.Promise.resolve();
}

SequelizeRelationImpl.prototype.fetch = function(limit, offset) {
    var self = this;
    
    limit = limit || 100; // TODO
    offset = offset || 0;
    
    return self.promiseWrap(self.objectImpl.sequelizeInstance['get' + SequelizeNameMapper.sequelizeAssociationAs(self.definition)]({
        offset: offset,
        limit: limit
    })).then(function(sequelizeInstances) {
        self._offset = offset;
        self._limit = limit;
        
        return self.sequelizeModel.loadBackeryObjects(sequelizeInstances, self.definition.type.relatedEntity);
    }).then(function(objects) {
        return Backery.Promise.resolve(self._fetched = objects);
    });
}

SequelizeRelationImpl.prototype.fetched = function() {
    return this._fetched;
}

SequelizeRelationImpl.prototype.offset = function() {
    return this._offset;
}

SequelizeRelationImpl.prototype.limit = function() {
    return this._limit;
}

module.exports = SequelizeRelationImpl;
