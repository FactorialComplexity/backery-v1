var requests = module.exports = {};

requests.CreateRequest = require('./requests/CreateRequest.js');
requests.ReadRequest = require('./requests/ReadRequest.js');
requests.UpdateRequest = require('./requests/UpdateRequest.js');
requests.DeleteRequest = require('./requests/DeleteRequest.js');
requests.QueryRequest = require('./requests/QueryRequest.js');

requests.CustomEndpointRequest = require('./requests/CustomEndpointRequest.js');
