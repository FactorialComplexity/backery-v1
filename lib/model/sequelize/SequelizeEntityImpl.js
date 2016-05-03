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
    var sequelizeInstance = this.sequelizeEntityModel.build();
    var object = this.sequelizeModel.createBackeryObject(sequelizeInstance, this.definition);
    return object;
}

SequelizeEntityImpl.prototype.get = function(id, include) {
    var self = this;
    
    var options = { };
    
    if (include) {
        options.include = self.sequelizeModel.transformInclude(self.definition, include);
    }
    
    return self.promiseWrap(self.sequelizeEntityModel.findById(parseInt(id), options), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return self.sequelizeModel.createBackeryObject(sequelizeInstance, self.definition, include);
        } else {
            return undefined;
        }
    });
}

SequelizeEntityImpl.prototype.ref = function(id) {
    var sequelizeInstance = this.sequelizeEntityModel.build({ id: parseInt(id) }, { isNewRecord : false });
    return this.sequelizeModel.createBackeryObject(sequelizeInstance, this.definition, undefined, true);
}

SequelizeEntityImpl.prototype.query = function() {
    return new BackeryQuery(new SequelizeQueryImpl(this.definition, this.sequelizeModel),
        this.sequelizeModel.Backery);
}

SequelizeEntityImpl.prototype.getAllEntities = function() {
    return this.sequelizeModel.entities;
}

module.exports = SequelizeEntityImpl;
