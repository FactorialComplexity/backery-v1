var SequelizeSQL = function(model) {
    var _model = model;
    var self = this;
    
    this.select = function(sql, bind) {
        return _model.promiseWrap(_model._sequelize.query(sql, {
            bind: bind,
            type: _model._sequelize.QueryTypes.SELECT
        }));
    }
    
    this.bind = {
        id: function(value) {
            return parseInt(value);
        }
    }
}

module.exports = SequelizeSQL;
