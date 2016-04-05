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
    var _files;
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
    
    this.setValues = function(values) {
        _files = values.files;
        
        return _super.setValues(values.body);
    }
    
    this.destroy = function() {
        manager.delete(impl.File_getStorage());
        _super.destroy();
    },
    
    this.save = function() {
        var mediaUUID = uuid.v4(), mediaJSON;

        return manager.upload(_files.body.path, mediaUUID + path.extname(_files.body.name), { content_type: _files.body.type })
          .then(function(storage) {
              impl.File_setStorageType(manager.getName());
              impl.File_setStorage(storage);
              impl.File_setContentType(_files.body.type);
              impl.File_setSize(_files.body.size);
              
              impl.getEntityDefinition().validateBeforeSave(this);
              
              return _super.save();
          }, function(error) {
              return manager.delete(storage);
          });
    }
}

util.inherits(BackeryFile, BackeryObject);

module.exports = BackeryFile;
