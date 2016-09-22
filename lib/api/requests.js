var requests = module.exports = {};

requests.CreateOrUpdateRequest = require('./requests/CreateOrUpdateRequest.js');
requests.ReadRequest = require('./requests/ReadRequest.js');
requests.DeleteRequest = require('./requests/DeleteRequest.js');
requests.QueryRequest = require('./requests/QueryRequest.js');

requests.CustomEndpointRequest = require('./requests/CustomEndpointRequest.js');
