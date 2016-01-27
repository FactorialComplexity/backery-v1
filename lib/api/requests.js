var requests = module.exports = {};

requests.CreateRequest = require('./requests/CreateRequest.js');
requests.ReadRequest = require('./requests/ReadRequest.js');
requests.UpdateRequest = require('./requests/UpdateRequest.js');

requests.DeleteRequest = function(entity, objectId) {
    this.entity = entity;
    this.objectId = objectId;
}

requests.QueryRequest = function(entity, queryData) {
    this.entity = entity;
    this.queryData = queryData;
}
