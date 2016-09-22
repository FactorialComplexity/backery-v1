var _ = require('underscore');

var BackeryQuery = require('../BackeryQuery.js');
var SequelizeQueryImpl = require('./SequelizeQueryImpl.js');

var SequelizeEntityImpl = function(definition, sequelizeEntityModel, sequelizeModel) {
    this.definition = definition;
    this.entity = sequelizeModel.entities[definition.name];
    this.sequelizeEntityModel = sequelizeEntityModel;
    
    this.sequelizeModel = sequelizeModel;
    this.Promise = sequelizeModel.Backery.Promise;
    this.promiseWrap = sequelizeModel.promiseWrap;
}

SequelizeEntityImpl.prototype.create = function() {
    return this.sequelizeModel.createBackeryObject(this.definition);
}

SequelizeEntityImpl.prototype.get = function(id, include) {
    var self = this;
    
    var options = { };
    
    if (include) {
        options.include = self.sequelizeModel.transformInclude(self.definition, include);
    }
    
    return self.promiseWrap(self.sequelizeEntityModel.findById(parseInt(id), options)).then(function(sequelizeInstance) {
        if (sequelizeInstance) {
            return self.sequelizeModel.loadBackeryObject(sequelizeInstance, self.definition, include);
        } else {
            return self.Promise.resolve();
        }
    });
}

SequelizeEntityImpl.prototype.ref = function(id) {
    return this.sequelizeModel.createBackeryObjectRef(id, this.definition);
}

SequelizeEntityImpl.prototype.query = function() {
    return new BackeryQuery(new SequelizeQueryImpl(this.definition, this.sequelizeModel),
        this.sequelizeModel.Backery);
}

SequelizeEntityImpl.prototype.getAllEntities = function() {
    return this.sequelizeModel.entities;
}

module.exports = SequelizeEntityImpl;
