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

SequelizeEntityImpl.prototype.get = function(id) {
    var self = this;
    return self.promiseWrap(self.sequelizeModel.findById(parseInt(id)), function(sequelizeInstance) {
        if (sequelizeInstance) {
            return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, self.definition, self.context));
        } else {
            return undefined;
        }
    });
}

SequelizeEntityImpl.prototype.ref = function(id) {
    var sequelizeInstance = this.sequelizeModel.build({ id: parseInt(id) }, { isNewRecord : false });
    return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, this.definition, this.context));
}

SequelizeEntityImpl.prototype.load = function(values) {
    var sequelizeInstance = this.sequelizeModel.build(values, { isNewRecord : false });
    return new BackerObject(new SequelizeObjectImpl(sequelizeInstance, this.definition, this.context));
}

SequelizeEntityImpl.prototype.query = function() {
    return new BackerQuery(this, new SequelizeQueryImpl(this.definition, this.sequelizeModel, this.context));
}

module.exports = SequelizeEntityImpl;
