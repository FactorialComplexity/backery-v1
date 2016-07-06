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
                return _.map(result, function(sequelizeInstance) {
                    return _model.createBackeryObject(sequelizeInstance, entity.getDefinition());
                });
            } else {
                return result;
            }
        });
    }
    
    this.bind = {
        id: function(value) {
            return parseInt(value);
        }
    }
}

module.exports = SequelizeSQL;
