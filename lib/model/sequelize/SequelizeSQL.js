var _ = require('lodash');

var SequelizeSQL = function(model) {
    var _model = model;
    var self = this;
    
    this.select = function(sql, bind, entity) {
        return _model.promiseWrap(_model._sequelize.query(sql, {
            bind: bind,
            type: _model._sequelize.QueryTypes.SELECT,
            model: entity ? _model._sequelizeModels[entity.getName()] : undefined
        }), function(result) {
            if (entity) {
                return _model.loadBackeryObjects(result, entity.getDefinition());
            } else {
                return result;
            }
        });
    }
    
    this.bind = {
        id: function(value) {
            if (_.isFunction(value.objectId))
                value = value.objectId();
            return parseInt(value);
        }
    }
}

module.exports = SequelizeSQL;