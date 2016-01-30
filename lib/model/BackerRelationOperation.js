var _ = require('underscore');
var errors = require('../utils/errors.js');

function hasNotAllowedKeys(object, allowedKeys) {
    return _.difference(allowedKeys, _.keys(object)).length > 0;
}

var BackerRelationOperation = function(data, relatedEntity) {
    var self = this;
    
    var _type;
    var _objects;
    
    if (!_.isObject(data) || hasNotAllowedKeys(data, ['__type', 'objects'])) {
        throw new errors.BackerInvalidParametersError('RelationOperation data object contains unsupported keys');
    }

    if (!_.contains(['set', 'add', 'remove'], data['__type'])) {
        throw new errors.BackerInvalidParametersError('RelationOperation data object has incorrect type');
    }
    
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
    
    this.getType = function() {
        return _type;
    }
    
    this.getObjects = function() {
        return _objects;
    }
}

BackerRelationOperation.Set = function(objectIds, relatedEntity) {
    return new BackerRelationOperation({ objects: objectIds, __type: 'set' }, relatedEntity);
}

BackerRelationOperation.Add = function(objectIds, relatedEntity) {
    return new BackerRelationOperation({ objects: objectIds, __type: 'add' }, relatedEntity);
}

BackerRelationOperation.Remove = function(objectIds, relatedEntity) {
    return new BackerRelationOperation({ objects: objectIds, __type: 'remove' }, relatedEntity);
}

module.exports = BackerRelationOperation;
