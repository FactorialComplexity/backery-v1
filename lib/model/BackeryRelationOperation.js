var _ = require('underscore');
var errors = require('../utils/errors.js');

var BackeryRelationOperation = function(data, relatedEntity) {
    var self = this;

    var _add = [];
    var _remove = [];
    var _set = [];

    function _normalizeAddRemove() {

        var int = _.intersection(_.map(_add, function(obj){return obj.objectId()}), _.map(_remove, function(obj){return obj.objectId()}));
        _add = _.filter(_add, function(obj){return !_.include(int, obj.objectId())});
        _remove = _.filter(_remove, function(obj){return !_.include(int, obj.objectId())});
    }
    
    if (data) {
        if (data['__type'] != 'RelationOperation') {
            throw new errors.BackeryInvalidParametersError('RelationOperation data object is not of correct __type');
        }

        function _parseObjects(action) {
            return _.map(data[action], function(objectId) {
                if (!_.isString(objectId)) {
                    throw new errors.BackeryInvalidParametersError('RelationOperation add has incorrect objectIds');
                }

                return relatedEntity.ref(objectId);
            });
        }

        _set = _parseObjects('set');
        _add = _parseObjects('add');
        _remove = _parseObjects('remove');

        _normalizeAddRemove();
    }
    if (_set.length && (_add.length || _remove.length)) {
        throw new errors.BackeryInvalidParametersError('RelationOperation contains both set and add or remove');
    }
    
    this.set = function(objects) {
        _set = _.map(objects, function(object) {
            if (_.isFunction(object.objectId)) {
                return object;
            } else if (_.isString(object)) {
                return relatedEntity.ref(object);
            } else {
                throw new errors.BackeryInvalidParametersError('RelationOperation set contains invalid objects');
            }
        });

        _add = [];
        _remove = [];
    }

    function _concatAddOrRemoveObjects(array, objects) {
        array = _.uniq(array.concat(_.map(objects, function(object) {
            if (_isFunction(object.objectId)) {
                return object;
            } else if (_.isString(object)) {
                return relatedEntity.ref(object);
            } else {
                throw new errors.BackeryInvalidParametersError('RelationOperation set contains invalid objects');
            }
        })), function(object) {
            return object.objectId();
        });

        _set = [];
        _normalizeAddRemove();

        return array;
    }

    this.add = function(objects) {
        _add = _concatAddOrRemoveObjects(_add, objects);
    }

    this.remove = function(objects) {
        _remove = _concatAddOrRemoveObjects(_remove, objects);
    }

    this.getAdd = function() {
        return _add.slice(0); // clone array
    }

    this.getRemove = function() {
        return _remove.slice(0); // clone array
    }

    this.getSet = function() {
        return _set.slice(0); // clone array
    }

    this.isEmpty = function() {
        return _remove.length == 0 && _set.length == 0 && _add.length == 0;
    }
}

BackeryRelationOperation.Set = function(objects, relatedEntity) {
    var op = new BackeryRelationOperation(undefined, relatedEntity);
    op.set(objects);
    return op;
}

BackeryRelationOperation.Add = function(objectIds, relatedEntity) {
    var op = new BackeryRelationOperation(undefined, relatedEntity);
    op.add(objects);
    return op;
}

BackeryRelationOperation.Remove = function(objectIds, relatedEntity) {
    var op = new BackeryRelationOperation(undefined, relatedEntity);
    op.remove(objects);
    return op;
}

module.exports = BackeryRelationOperation;
