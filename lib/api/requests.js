var requests = module.exports = {};

requests.CreateRequest = require('./requests/CreateRequest.js');
requests.ReadRequest = require('./requests/ReadRequest.js');
requests.UpdateRequest = require('./requests/UpdateRequest.js');
requests.DeleteRequest = require('./requests/DeleteRequest.js');

requests.QueryRequest = function(entity, queryData) {
    this.entity = entity;
    this.queryData = queryData;
}
