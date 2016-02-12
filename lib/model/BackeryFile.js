var _ = require('underscore');
var errors = require('../utils/errors.js');

function hasNotAllowedKeys(object, allowedKeys) {
    return _.difference(allowedKeys, _.keys(object)).length > 0;
}

var BackeryFile = function(data) {
    var pimpl = impl;
    var self = this;
    
    var _name;
    var _id;
    var _storage;
    
    if (data) {
        if (!_.isObject(data) || hasNotAllowedKeys(data, ['__type', 'name', 'id', 'storage'])) {
            throw new errors.BackeryInvalidParametersError('File data object contains unsupported keys');
        }
    
        if (data['__type'] != 'File') {
            throw new errors.BackeryInvalidParametersError('File data object has incorrect type');
        }
        
        _name = data['name'];
        _id = data['id'];
        _storage = data['storage'];
        
        if (!_.isString(data['name']))
            throw new errors.BackeryInvalidParametersError('Invalid name in File data object');
        if (!_.isString(data['id']))
            throw new errors.BackeryInvalidParametersError('Invalid id in File data object');
        
        if (!_.isObject(data['storage'])) {
            throw new errors.BackeryInvalidParametersError('Invalid storage in File data object');
        } else {
            if (data['storage']['type'] == 's3') {
                if (!_.isString(data['storage']['bucket'])) {
                    throw new errors.BackeryInvalidParametersError('No bucket for S3 storage specified in File data object');
                }
                
                if (hasNotAllowedKeys(data['storage'], ['type', 'bucket'])) {
                    throw new errors.BackeryInvalidParametersError('Invalid storage in File data object');
                }
            } else {
                throw new errors.BackeryInvalidParametersError('Invalid storage type in File data object');
            }
        }
    }
}

module.exports = BackeryFile;