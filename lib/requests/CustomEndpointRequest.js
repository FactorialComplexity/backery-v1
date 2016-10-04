var CustomEndpointRequest = function(method, endpoint, request, user, Backery) {
    
    Object.defineProperty(this, 'type', { get: function() { return 'CustomEndpoint'; } });
    
    Object.defineProperty(this, 'method', { get: function() { return method; } }); // HTTP method
    Object.defineProperty(this, 'endpoint', { get: function() { return endpoint; } }); // path template in endpoint

    Object.defineProperty(this, 'path', { get: function() { return request.path; } }); // actual path
    Object.defineProperty(this, 'params', { get: function() { return request.params; } });
    Object.defineProperty(this, 'body', { get: function() { return request.body; } });
    Object.defineProperty(this, 'verbose', { get: function() { return request.verbose; } });
    Object.defineProperty(this, 'files', { get: function() { return request.files; } });
    
    Object.defineProperty(this, 'user', { get: function() { return user; } });
    
    var self = this;
    
    this.getValidationError = function() {
        return undefined;
    }
}

module.exports = CustomEndpointRequest;
