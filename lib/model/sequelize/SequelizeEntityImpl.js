var _ = require('underscore');

var BackeryObject = require('../BackeryObject.js');
var SequelizeObjectImpl = require('./SequelizeObjectImpl.js');

var BackeryQuery = require('../BackeryQuery.js');
var SequelizeQueryImpl = require('./SequelizeQueryImpl.js');

var SequelizeEntityImpl = function(definition, sequelizeEntityModel, sequelizeModel) {
    this.definition = definition;
    this.sequelizeEntityModel = sequelizeEntityModel;
    
    this.sequelizeModel = sequelizeModel;
    this.Promise = sequelizeModel.Backery.Promise;
    this.promiseWrap = sequelizeModel.promiseWrap;
}

SequelizeEntityImpl.prototype.create = function() {
    var sequelizeInstance = this.sequelizeEntityModel.build();
    var object = new BackeryObject(new SequelizeObjectImpl(sequelizeInstance, this.definition, this.sequelizeModel),
        this.sequelizeModel.Backery);
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
            return new BackeryObject(new SequelizeObjectImpl(sequelizeInstance, self.definition, self.sequelizeModel, include),
                self.sequelizeModel.Backery);
        } else {
            return undefined;
        }
    });
}

SequelizeEntityImpl.prototype.ref = function(id, values) {
    var sequelizeInstance = this.sequelizeEntityModel.build(_.extend({ id: parseInt(id) }, values), { isNewRecord : false });
    return new BackeryObject(new SequelizeObjectImpl(sequelizeInstance, this.definition, this.sequelizeModel),
        this.sequelizeModel.Backery);
}

SequelizeEntityImpl.prototype.load = function(values) {
    var sequelizeInstance = this.sequelizeEntityModel.build(values, { isNewRecord : false });
    return new BackeryObject(new SequelizeObjectImpl(sequelizeInstance, this.definition, this.sequelizeModel),
        this.sequelizeModel.Backery);
}

SequelizeEntityImpl.prototype.query = function() {
    return new BackeryQuery(this.definition, new SequelizeQueryImpl(this.definition, this.sequelizeEntityModel, this.sequelizeModel),
        this.sequelizeModel.Backery);
}

SequelizeEntityImpl.prototype.getAllEntities = function() {
    return this.sequelizeModel.entities;
}

module.exports = SequelizeEntityImpl;
