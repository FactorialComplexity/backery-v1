var fs = require('fs');
var _ = require('underscore');
var path = require('path');

var requestContextNamespace = require('continuation-local-storage').createNamespace('io.backery.request.context');

var SMTPMailer = require('./mailer/SMTPMailer.js');
var errors = require('./utils/errors.js');

var Authentication = require('./authentication/Authentication.js');
var TrustedExtensionsRunner = require('./extensions/TrustedExtensionsRunner.js');
var ExtensionResponse = require('./extensions/ExtensionResponse.js');

var ModelDefinition = require('./model/definition/ModelDefinition.js');
var SequelizeDatabase = require('./model/sequelize/SequelizeDatabase.js');
var Backery = require('./model/Backery.js');
var BackeryRole = require('./model/BackeryRole.js')
var PushNotificationsQueueMemory = require('./push/PushNotificationsQueueMemory.js');
var PushNotificationsSender = require('./push/PushNotificationsSender.js');


var Application = function(nconf, database, Backery) {
    var self = this;

    self.Backery = Backery;
    self.Request = {
        CreateOrUpdate: require('./requests/CreateOrUpdateRequest.js'),
        Read: require('./requests/ReadRequest.js'),
        Delete: require('./requests/DeleteRequest.js'),
        Query: require('./requests/QueryRequest.js'),
        CustomEndpoint: require('./requests/CustomEndpointRequest.js')
    };

    var _database = database;
    var _nconf = nconf;
    var _extensionsRunner = new TrustedExtensionsRunner(_nconf.get('paths:extension-code'),
        _database.getDefinition().getName(), nconf.get('custom'), Backery);

    function databaseHook(entityDefinition, type) {

        function afterSaveUser(object, entityDefinition, type) {

            if (type === 'afterSave' && !Array.isArray(entityDefinition) && entityDefinition.isUserEntity()) {
                //invalidate/update cache
                console.log('Invalidating/updating users cache with user: ', object.objectId());
                return self.getAuthentication().getAccessTokensStorage().storeUser(object);
            } else {
                return Backery.Promise.resolve(object);
            }
        }

        return function(object, arg1) {
            var hook = _extensionsRunner.getDatabaseHook(entityDefinition.name, type);
            if (hook) {
                var ret = hook(object, arg1);
                return _.isUndefined(ret) ? afterSaveUser(object, entityDefinition, type) :
                    ret.then(function() {
                        afterSaveUser(object, entityDefinition, type);
                    });
            } else {
                return afterSaveUser(object, entityDefinition, type);
            }
        }
    }

    _database.setDatabaseHooksProvider({
        getDatabaseHooks: function(entityDefinition) {
            return {
                afterFetch: databaseHook(entityDefinition, 'afterFetch'),

                beforeSave: databaseHook(entityDefinition, 'beforeSave'),
                afterSave: databaseHook(entityDefinition, 'afterSave'),

                beforeDestroy: databaseHook(entityDefinition, 'beforeDestroy'),
                afterDestroy: databaseHook(entityDefinition, 'afterDestroy')
            };
        }
    });

    self.getModelDefinition = function() {
        return _database.getDefinition();
    }

    self.getModel = function() {
        return _database;
    }

    self.getRequestContextNamespace = function() {
        return requestContextNamespace;
    }

    var _auth = new Authentication(this, nconf);
    self.getAuthentication = function() {
        return _auth;
    }

    self.getName = function() {
        return _database.getDefinition().getName();
    }

    self.getDisplayName = function() {
        return _database.getDefinition().getDisplayName() || _database.getDefinition().getName();
    }

    self.getCustomEndpointsList = function() {
        return _extensionsRunner.getCustomEndpointsList();
    }

    self.getRequestHooks = function() {
        return _extensionsRunner.getRequestHooks();
    }

    self.getDatabaseHooks = function() {
        return _extensionsRunner.getDatabaseHooks();
    }

    self.getOnListenHooks = function() {
        return _extensionsRunner.getOnListenHooks();
    }

    self.getSubApplications = function() {
        return _extensionsRunner.getSubApplications();
    }

    self.getCookiePrivateKey = function() {
        return _nconf.get('oauth2:cookie_private_key');
    }

    var _backeryPackageJSON = require(__dirname + '/../package.json');
    var _extensionPackageJSON = _nconf.get('paths:extension-code') ?
        require(path.dirname(path.resolve(_nconf.get('paths:extension-code'))) + '/package.json') :
        undefined;

    self.getStatusObject = function() {
        return {
            application: {
                name: self.getName(),
                extension: {
                    version: _extensionPackageJSON ? _extensionPackageJSON.version : undefined
                }
            },
            backery: {
                version: _backeryPackageJSON.version,
            },
            environment: _nconf.get('meta:environment'),
            deployedAt: _nconf.get('meta:deployedAt')
        };
    }

    self.getSchemaJSONObject = function() {
        return _database.getDefinition().getAsJSONObject();
    }

    function _getAccessOperation(request) {
        if (request.type == 'Read')
            return 'read';
        if (request.type == 'Delete')
            return 'delete';
        if (request.type == 'Query') {
            if (request.query.isRelationQuery())
                return 'read';
            else
                return 'query';
        }
        else if (request.type == 'CreateOrUpdate')
            return request.isNew() ? 'create' : 'update';
    }

    function isRequestAccessibleByUser(request) {
        if (request.isMaster) { // request marked as "master" is always allowed
            return Backery.Promise.resolve(true);
        }

        var isRelationQuery = request.type === 'Query' && request.query.isRelationQuery();

        var isAllowed = false;
        var user = request.user;
        var entity = isRelationQuery ? request.query.relatedToObject.entity : request.entity;

        var allowedRolesDefinitions = entity.getDefinition().access.allow[_getAccessOperation(request)];
        var allowedRoles = _.compact(_.map(allowedRolesDefinitions, function(roleDefinition) {
            if (!roleDefinition.isContextual()) {
                return Backery.Model.Roles[roleDefinition.name];
            }
        }));

        if (allowedRoles) {
            if (user) {
                isAllowed = !!_.find(allowedRoles, function(role) {
                    return role.isUser() || role.isPublic() || user.hasRole(role)
                });
            } else {
                isAllowed = !!_.find(allowedRoles, function(role) {
                    return role.isPublic();
                });
            }
        }

        if (isAllowed) { // allowed due to static role permission
            return Backery.Promise.resolve(true);
        }


        // check contextual (dynamic) roles
        var allowedContextualRoles = _.compact(_.map(allowedRolesDefinitions, function(roleDefinition) {
            if (roleDefinition.isContextual()) {
                return roleDefinition;
            }
        }));

        if (allowedContextualRoles.length && user) {
            // if (request.type === 'CreateOrUpdate' && request.isNew()) {
            //     // create request needs to check, that allowed fields are set to a calling user profile
            //     // TODO
            // }

            var objectId = isRelationQuery ? request.query.relatedToObject.objectId() : request.objectId;

            return Backery.Promise.each(allowedContextualRoles, function(roleDefinition) {
                return database.areObjectsRelatedThroughPath(entity.load(objectId), user, roleDefinition.relationPath)
                    .then(function(related) {

                    if (!related) {
                        return self.Backery.Promise.reject(new errors.BackeryUnauthorizedError('User is not allowed to execute operation \"' +
                            _getAccessOperation(request)  + '\" on entity ' + entity.getName() +
                            ' (no access to object with id: ' + objectId + ')'));
                    }
                });
            }).then(function() {
                return Backery.Promise.resolve(true);
            });
        }

        return Backery.Promise.resolve(false);
    }

    function getValueNamesNotWritableByUser(request) {
        if (!request.values || request.isMaster) {
            return;
        }

        var user = request.user;
        return _.map(_.filter(request.entity.getDefinition().fields, function(field) {
            var isDenied = false;

            if (request.values[field.name] !== undefined) {
                var allowedRoles = _.map(field.access.allow.write, function(roleDefinition){
                    return Backery.Model.Roles[roleDefinition.name];
                });

                if (user) {
                    isDenied = !_.find(allowedRoles, function(role) {
                        return role.isPublic() || role.isUser() || user.hasRole(role);
                    });
                } else {
                    isDenied = !_.find(allowedRoles, function(role) {
                        return role.isPublic();
                    });
                }
            }

            return isDenied;
        }), function(field) {
            return field.name;
        });
    }


    self.processRequest = function(request, extra) {
        console.log('Application.processRequest', request.type, extra);

        if (request.getValidationError()) {
            return self.Backery.Promise.reject(request.getValidationError());
        } else {
            request = Object.assign(request, extra);

            if (request.type != 'CustomEndpoint') {
                return isRequestAccessibleByUser(request).then(function(accessible) {
                    if (accessible) {
                        var notWritable = getValueNamesNotWritableByUser(request);

                        if (request.type == 'CreateOrUpdate' && notWritable && notWritable.length) {
                            return self.Backery.Promise.reject(new errors.BackeryUnauthorizedError('User is not allowed to execute operation \"' +
                                _getAccessOperation(request)  + '\" on entity ' + request.entity.getName() + ' (writing some fields is not allowed: ' + notWritable.join(', ') + ')'));
                        }

                        if (request.type === 'Query' && request.query.isRelationQuery()) {
                            var allowedRoles = _.map(request.query.relatedFieldDefinition.access.allow.read, function(roleDefinition){
                                return Backery.Model.Roles[roleDefinition.name];
                            });

                            if (request.user) {
                                isDenied = !_.find(allowedRoles, function(role) {
                                    return role.isPublic() || role.isUser() || request.user.hasRole(role);
                                });
                            } else {
                                isDenied = !_.find(allowedRoles, function(role) {
                                    return role.isPublic();
                                });
                            }

                            if (isDenied) {
                                return self.Backery.Promise.reject(new errors.BackeryUnauthorizedError('User is not allowed to execute operation \"' +
                                    _getAccessOperation(request)  + '\" on entity ' + request.query.relatedToObject.entity.getName() + ' (reading field is not allowed: ' +
                                    request.query.relatedFieldDefinition.name + ')'));
                            }
                        }

                        if (_extensionsRunner.hasRequestHook(request)) {
                            return new self.Backery.Promise(function(resolve, reject) {
                                _extensionsRunner.processRequest(request, new ExtensionResponse(resolve, reject));
                            });
                        } else {
                            return request.prepare().then(function(request) {
                                return request.execute();
                            });
                        }
                    } else {
                        return self.Backery.Promise.reject(new errors.BackeryUnauthorizedError('User is not allowed to execute operation \"'
                            + _getAccessOperation(request) + '\" on entity ' + request.entity.getName()));
                    }
                });
            } else {
                // Custom endpoints are always processed by extensions code
                return new self.Backery.Promise(function(resolve, reject) {
                    _extensionsRunner.processEndpoint(request.method, request.endpoint,
                        request, new ExtensionResponse(resolve, reject));
                });
            }
        }
    }

    // Recover password
    function _getEmailAuthField() {
        var passwordAuthMethod = _.find(self.getModelDefinition().authMethods, function(authMethod) {
            return authMethod.isPassword();
        });

        if (!passwordAuthMethod)
            return;

        return passwordAuthMethod.passwordRecoveryEmailField;
    }

    self.isPasswordRecoveryEmailSupported = function() {
        return !!_getEmailAuthField();
    }

    self.sendPasswordRecoveryEmail = function(email) {
        var User = _database.entity('User');
        var emailField = _getEmailAuthField();

        if (!emailField) {
            return Backery.Promise.reject(new errors.BackeryConsistencyError('Password cannot be recovered via email, ' +
                'because email field login field is not specified'));
        }

        console.log('PWD RECOVERY (' + email + ')');

        return User.query().where(emailField.name, email).findOne().then(function(user) {
            if (user) {
                return user.resetPasswordRecoveryToken();
            } else {
                return Backery.Promise.reject(new errors.BackeryNotFoundError('User with email ' + email + ' is not registered'));
            }
        }).then(function(token) {
            var recoverText =
                'Hello\n\n' +
                'Someone, hopefully you, has requested that your password for ' + self.getDisplayName() + ' be reset.\n' +
                'Please copy the following url into your browser to complete the password reset process.\n\n' +
                'http' + (nconf.get('http:publicHost:ssl') ? 's' : '') + '://' + nconf.get('http:publicHost:name') +
                    (nconf.get('http:publicHost:port') ? ':' + nconf.get('http:publicHost:port') : '') + '/web/reset-password/?token=' + token + '\n\n'
                'Thank you';

            return self.mailer.sendMail({
                from: _nconf.get('mailer:from'),
                to: email,
                subject: self.getDisplayName() + ': Reset Password',
                text: recoverText
            }).then(function(response) {
                console.log('PWD RECOVERY (' + email + ') ' + response)
            }).catch(function(error) {
                console.log('PWD RECOVERY (' + email + ') ERROR ', error)
            });
        });
    }

    self.resetPassword = function(token, password) {
        return _database.findUserWithPasswordRecoveryToken(token).then(function(user) {
            if (user && user.isPasswordRecoveryTokenValid(token)) {
                user.setValues({ password, oldPassword: token });
                return user.save();
            } else {
                return Backery.Promise.reject(new errors.BackeryNotFoundError('Invalid token specified'));
            }
        });
    }
}

module.exports = function initialize(nconf, schema) {
    var availableFileManagers = {
        's3': require('./model/files/S3FileManager.js')
    }

    if (!_.isFunction(schema.getName)) {
        schema = new ModelDefinition(schema);
    }

    // reset password
    if (nconf.get('mailer:type')) {
        var mailerType = nconf.get('mailer:type');
        var _mailer;

        if (mailerType == 'smtp') {
            _mailer = new SMTPMailer(nconf.get('mailer:config'), Backery);
        }

        Backery.Mailer = {
            send: function(options) {
                return _mailer.sendMail(options);
            }
        }

        Object.defineProperty(Application.prototype, 'mailer', { get: function() { return _mailer; } });
    }

    var pushNotificationsQueue = new PushNotificationsQueueMemory(), pushNotificationsSender;
    var database = new SequelizeDatabase();

    return database.initialize(schema, nconf.get('database:uri'), nconf.get('database:options'), Backery).then(function() {
        //console.log('Database setup completed');

        var entities = { };
        _.each(schema.entities, function(entityDefinition) {
            entities[entityDefinition.name] = database.entity(entityDefinition.name);
        });

        if (nconf.get('files')) {
            var filesConfig = nconf.get('files');
            _.each(filesConfig, function(value, key) {
                var Manager = availableFileManagers[key];
                manager = new Manager(filesConfig[key], Backery);
                database.registerFileManager(manager, filesConfig[key].default);
            });
        }/* else {
           return Backery.Promise.reject(new Error('Default file manager is not defined'));
        }*/

        if (nconf.get('pushNotifications')) {
            pushNotificationsSender = new PushNotificationsSender(nconf.get('pushNotifications'), entities,
                pushNotificationsQueue, Backery);
            pushNotificationsSender.start();
        }

        Backery.Model = entities;

        // Roles
        var roles = {};
        _.each(schema.roles, function(roleDefinition) {
            roles[roleDefinition.name] = new BackeryRole(roleDefinition);
        });
        Backery.Model.Roles = roles;

        // SQL
        if (database.SQL) {
            Backery.SQL = database.SQL;
        }

        // Wrap functions that require database with wrappers, providing database object
        Backery.Struct.fromJSON = _.partial(Backery.Struct.fromJSON, _, _, database);
        Backery.Object.load = _.partial(Backery.Object.load, _, database);
        Backery.Push.send = _.partial(Backery.Push.send, _, _, pushNotificationsQueue);

        var app = new Application(nconf, database, Backery);

        // Authentication middleware with context support. CLS context is accessible only inside subsequent
        // sync and async calls, but not in event listeners.
        // To allow event-based extensions such as socket.io server to use context,
        // context namespase is attached to request, so that extension code could run event listeners in context.
        // If 'next' argument is undefined, method just checks token and returns user object if it is valid.
        Backery.Context.authenticate = (req, res, next) => {
            return app.getAuthentication().getAccessToken(req.accessToken)
                .then(tokenObject => {
                    if (!(tokenObject && tokenObject.user)) {
                        return (next && 
                            next(new Backery.Error.Unauthorized()) ||
                            Backery.Promise.reject(new Backery.Error.Unauthorized()) 
                        )
                    }
                    if (!next) {
                        return Backery.Promise.resolve(tokenObject.user)
                    }
                    req.user = tokenObject.user;
                    req.ctx = requestContextNamespace;
                    req.ctx.run(function(outer) {
                        req.ctx.set('user', req.user);
                        next();
                    })
                })
              .catch(error => (next &&
                  next(new Backery.Error.Unauthorized()) ||
                  Backery.Promise.reject(new Backery.Error.Unauthorized())
              ))
        }

        return app;
    });
};
