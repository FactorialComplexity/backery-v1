var _ = require('underscore');
var Promise = require('promise');
var BackeryCondition = require('./model/classes/BackeryCondition.js');
var Struct = require('./api/BackeryStruct.js');
var Promise = require('promise');
var errors = require('./utils/errors.js');

require('promise/lib/rejection-tracking').enable();

var Backery = module.exports = {
    Promise: Promise,
    Struct: Struct,
    
    Error: {
        NotFound: function(what, id) {
            Object.defineProperty(this, 'name', { get: function() { return 'BackeryNotFoundError'; } });
            Object.defineProperty(this, 'status', { get: function() { return 404; } });
            Object.defineProperty(this, 'message', { get: function() {
                if (_.isUndefined(id))
                    return what;
                else
                    return what + ' (id: ' + id + ') not found';
            }});
        }
    }
};

_.each(BackeryCondition, function(value, key) {
    Backery[key] = value;
});
