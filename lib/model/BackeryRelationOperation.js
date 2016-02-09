var _ = require('underscore');
var errors = require('../utils/errors.js');

function hasNotAllowedKeys(object, allowedKeys) {
    return _.difference(allowedKeys, _.keys(object)).length > 0;
}

var BackeryRelationOperation = function(data, relatedEntity) {
    var self = this;
    
    var _action;
    var _objects;
    
    if (!_.isObject(data) || hasNotAllowedKeys(data, ['__type', 'action', 'objects'])) {
        throw new errors.BackerInvalidParametersError('RelationOperation data object contains unsupported keys');
    }
    
    if (data['__type'] != 'RelationOperation') {
        throw new errors.BackerInvalidParametersError('RelationOperation data object is not of correct __type');
    }

    if (!_.contains(['set', 'add', 'remove'], data['action'])) {
        throw new errors.BackerInvalidParametersError('RelationOperation data object has incorrect type');
    }
    
    _action = data['action'];
    
    if (_.detect(data['objects'], function(objectId) {
        if (!_.isString(objectId) || !objectId) {
            return true;
        }
    })) {
        throw new errors.BackerInvalidParametersError('RelationOperation data object has incorrect objects');
    } else {
        _objects = _.map(data['objects'], function(objectId) {
            return relatedEntity.ref(objectId);
        });
    }
    
    this.getAction = function() {
        return _action;
    }
    
    this.getObjects = function() {
        return _objects;
    }
}

BackeryRelationOperation.Set = function(objectIds, relatedEntity) {
    return new BackeryRelationOperation({ objects: objectIds, action: 'set', __type: 'RelationOperation' }, relatedEntity);
}

BackeryRelationOperation.Add = function(objectIds, relatedEntity) {
    return new BackeryRelationOperation({ objects: objectIds, action: 'add', __type: 'RelationOperation' }, relatedEntity);
}

BackeryRelationOperation.Remove = function(objectIds, relatedEntity) {
    return new BackeryRelationOperation({ objects: objectIds, action: 'remove', __type: 'RelationOperation' }, relatedEntity);
}

module.exports = BackeryRelationOperation;
