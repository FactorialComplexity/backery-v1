var _ = require('underscore');

var BackeryCondition = module.exports = {};

BackeryCondition.And = function(conditions) {
    if (!_.isArray(conditions)) {
        conditions = Array.prototype.slice.call(arguments);
    }
    
    return { $and: conditions };
}

BackeryCondition.Or = function(conditions) {
    if (!_.isArray(conditions)) {
        conditions = Array.prototype.slice.call(arguments);
    }
    
    return { $or: conditions };
}

function FieldNameValue(op, field, value) {
    var cond = {};
    cond[field] = value;
    
    var res = {};
    res[op] = cond;
    
    return res;
}

function FieldNameValues(op, field, values) {
    var cond = {};
    cond[field] = value;
    
    var res = {};
    res[op] = cond;
    
    return res;
}

BackeryCondition.Eq = function(field, value) {
    return FieldNameValue('$eq', field, value);
}

BackeryCondition.NotEq = function() {
    return FieldNameValue('$ne', field, value);
}

BackeryCondition.Greater = function(field, value) {
    return FieldNameValue('$gt', field, value);
}

BackeryCondition.GreaterEq = function(field, value) {
    return FieldNameValue('$gte', field, value);
}

BackeryCondition.Less = function(field, value) {
    return FieldNameValue('$lt', field, value);
}

BackeryCondition.LessEq = function(field, value) {
    return FieldNameValue('$lte', field, value);
}

BackeryCondition.In = function(field, value) {
    return FieldNameValue('$in', field, value);
}

BackeryCondition.NotIn = function(field, value) {
    return FieldNameValue('$notIn', field, value);
}

BackeryCondition.Contains = function(field, value) {
    return FieldNameValues('$contains', field, value);
}

BackeryCondition.ContainsCaseInsensitive = function(field, value) {
    return FieldNameValues('$containsCI', field, value);
}
