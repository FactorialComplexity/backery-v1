var util = require('util');
var _ = require('underscore');
var uuid = require('node-uuid');
var path = require('path');

var BackeryObject = require('./BackeryObject.js');

var errors = require('../utils/errors.js');

var BackeryFile = function(impl, Backery) {
  
    Object.defineProperty(this, 'url', { get: function() { return getUrl(); } });
    Object.defineProperty(this, 'contentType', { get: function() { return impl.File_getContentType(); } });
    Object.defineProperty(this, 'size', { get: function() { return impl.File_getSize(); } });
    
    BackeryObject.apply(this, arguments);
    
    var manager = impl.File_getManager();
    var self = this;
    var _body;
    var _super = {
        set: this.set,
        setValues: this.setValues,
        save: this.save,
        destroy: this.destroy,
        toStruct: this.toStruct
    };
    
    function getUrl() {
        return manager.getUrl(impl.File_getStorage());
    }
    
    this.toStruct = function(options) {
        var struct = _super.toStruct.call(this, options);
        
        if (!this.isRef()) {
            struct.set('_url', Backery.Struct.String(getUrl()));
            struct.set('_contentType', Backery.Struct.String(impl.File_getContentType()));
            struct.set('_size', Backery.Struct.Integer(impl.File_getSize()));
        }

        return struct;
    }
    
    this.set = function(key, value) {
        return _super.set(key, value);
    }
    
    this.setFileBody = function(body) {
        _body = body;
    }
    
    this.destroy = function() {
        manager.delete(impl.File_getStorage());
        _super.destroy();
    },
    
    this.save = function() {
        var mediaUUID = uuid.v4(), mediaJSON;
        
        if (self.isNew() && (!_body || !_body.path || !_body.name || !_body.contentType)) {
            return Backery.Promise.reject(new errors.BackeryConsistencyError('Cannot save empty file'));
        }
        
        if (self.isNew()) {
            return manager.upload(_body.path, mediaUUID + path.extname(_body.name), { content_type: _body.contentType }).then(function(storage) {
                impl.File_setStorageType(manager.getName());
                impl.File_setStorage(storage);
                impl.File_setContentType(_body.contentType);
                impl.File_setSize(_body.size);

                impl.getEntityDefinition().validateBeforeSave(self);

                return _super.save().then(function(object) {
                    return Backery.Promise.resolve(object);
                }, function(error) {
                    manager.delete(storage).then(function() {
                        return Backery.Promise.reject(error);
                    }, function() {
                        return Backery.Promise.reject(error);
                    });
                });
            });
         } else {
             return _super.save();
         }
    }
}

util.inherits(BackeryFile, BackeryObject);

module.exports = BackeryFile;
