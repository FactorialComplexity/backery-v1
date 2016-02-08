var _ = require('underscore');

var BackerObject = require('../BackerObject.js');
var SequelizeObjectImpl = require('./SequelizeObjectImpl.js');

var BackerQuery = require('../BackerQuery.js');
var SequelizeQueryImpl = require('./SequelizeQueryImpl.js');

var SequelizeEntityImpl = function(definition, sequelizeModel, context) {
    this.definition = definition;
    this.sequelizeModel = sequelizeModel;
    
    this.context = context;
    this.Promise = context.Promise;
    this.promiseWrap = context.promiseWrap;
}

SequelizeEntityImpl.prototype.create = function(values) {
    if (values['id']) {
        throw new Error('Cannot set `id` for BackerObject');
    }
    
    var sequelizeInstance = this.sequelizeModel.build(values ? values : {});
    return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, this.definition, this.context));
}

SequelizeEntityImpl.prototype.get = function(id, include) {
    var self = this;
    
    var options = { };
    
    if (include) {
        options.include = self.context.model.transformInclude(self.definition, include);
    }
    
    return self.promiseWrap(self.sequelizeModel.findById(parseInt(id), options), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, self.definition, self.context, include));
        } else {
            return undefined;
        }
    });
}

SequelizeEntityImpl.prototype.ref = function(id, values) {
    var sequelizeInstance = this.sequelizeModel.build(_.extend({ id: parseInt(id) }, values), { isNewRecord : false });
    return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, this.definition, this.context));
}

SequelizeEntityImpl.prototype.load = function(values) {
    var sequelizeInstance = this.sequelizeModel.build(values, { isNewRecord : false });
    return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, this.definition, this.context));
}

SequelizeEntityImpl.prototype.query = function() {
    return new BackerQuery(this, new SequelizeQueryImpl(this.definition, this.sequelizeModel, this.context));
}

SequelizeEntityImpl.prototype.getAllEntities = function() {
    return this.context.model.entities;
}

module.exports = SequelizeEntityImpl;
