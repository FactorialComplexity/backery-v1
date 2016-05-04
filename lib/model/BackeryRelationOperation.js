var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryRelationOperation = function(set, add, remove, relatedEntity) {
    var self = this;

    var _add = [];
    var _remove = [];
    var _set;

    function _normalizeAddRemove() {
        var int = _.intersection(_.map(_add, function(obj){return obj.objectId()}), _.map(_remove, function(obj){return obj.objectId()}));
        _add = _.filter(_add, function(obj){return !_.include(int, obj.objectId())});
        _remove = _.filter(_remove, function(obj){return !_.include(int, obj.objectId())});
    }

    function _parseObjects(objects) {
        if (_.isUndefined(objects)) {
            return [];
        } else if (_.isArray(objects)) {
            return _.map(objects, function(object) {
                if (_.isFunction(object.objectId)) {
                    return object;
                } else if (_.isString(object)) {
                    return relatedEntity.load(object);
                } else {
                    throw new errors.BackeryInvalidParametersError('RelationOperation params contains invalid objects');
                }
            });
        } else {
            throw new errors.BackeryInvalidParametersError('RelationOperation has incorrect params');
        }
    }

    _set = _.isUndefined(set) ? undefined : _parseObjects(set);
    _add = _parseObjects(add);
    _remove = _parseObjects(remove);

    _normalizeAddRemove();

    // if (!_set.length && !_add.length && !_remove.length) {
    //     throw new errors.BackeryInvalidParametersError('RelationOperation has no operations');
    // }

    if (!_.isUndefined(_set) && (_add.length || _remove.length)) {
        throw new errors.BackeryInvalidParametersError('RelationOperation contains both set and add or remove');
    }

    this.getChanges = function() {
        return { add: _add, remove: _remove, set: _set };
    }

    this.isEmpty = function() {
        return _remove.length == 0 && _.isUndefined(_set) && _add.length == 0;
    }
}

BackeryRelationOperation.FromData = function(data, relatedEntity) {
    if (data) {
        if (data['__type'] != 'RelationOperation') {
            throw new errors.BackeryInvalidParametersError('RelationOperation data object is not of correct __type');
        }

        var set = data.set;
        var add = data.add || [];
        var remove = data.remove || [];

        return new BackeryRelationOperation(set, add, remove, relatedEntity);
    } else {
        throw new errors.BackeryInvalidParametersError('RelationOperation data is undefined');
    }
}

BackeryRelationOperation.Set = function(objects, relatedEntity) {
    return new BackeryRelationOperation(objects, undefined, undefined, relatedEntity);
}

BackeryRelationOperation.AddRemove = function(add, remove, relatedEntity) {
    return new BackeryRelationOperation(undefined, add, remove, relatedEntity);
}

module.exports = BackeryRelationOperation;
