var Site = function(app, path, options, defaultOptions) {
    this._app = app;
    this._path = path;
    this._options = _.extend(defaultOptions, _.pick(options, _.keys(defaultOptions)));
}

Site.prototype._handle = function(method, route, options, handler) {
    var self = this;
    var handlerOptions = _.extend(self._options, _.pick(options, _.keys(self._options)));
    
    self._app[method](
        route,
        function authorize(req, res, next) {
            if (handlerOptions.auth) {
                handlerOptions.auth(req, res, next);
            } else {
                return next();
            }
        },
        
        function validateAndTransformParameters(req, res, next) {
            return next();
        },
        
        handler
    );
}

Site.prototype.get = function(route, options, handler) {
    return this._handle('get', route, options, handler);
}

Site.prototype.post = function(route, options, handler) {
    return this._handle('post', route, options, handler);
}

Site.prototype.put = function(route, options, handler) {
    return this._handle('put', route, options, handler);
}

Site.prototype.delete = function(route, options, handler) {
    return this._handle('put', route, options, handler);
}

Site.prototype.options = function(route, options, handler) {
    return this._handle('options', route, options, handler);
}

Site.prototype.head = function(route, options, handler) {
    return this._handle('head', route, options, handler);
}

module.exports = Site;
