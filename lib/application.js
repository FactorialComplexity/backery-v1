var fs = require('fs');
var _ = require('underscore');
var path = require('path');

var requestContextNamespace = require('continuation-local-storage').createNamespace('io.backery.request.context');

var SMTPMailer = require('./mailer/SMTPMailer.js');
var errors = require('./utils/errors.js');

var Authentication = require('./authentication/Authentication.js');
var TrustedExtensionsRunner = require('./extensions/TrustedExtensionsRunner.js');
var ExtensionResponse = require('./extensions/ExtensionResponse.js');

var SequelizeDatabase = require('./model/sequelize/SequelizeDatabase.js');
var Backery = require('./model/Backery.js');
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
        return function(object, arg1) {
            var hook = _extensionsRunner.getDatabaseHook(entityDefinition.name, type);
            if (hook) {
                var ret = hook(object, arg1);
                return _.isUndefined(ret) ? Backery.Promise.resolve(object) :
                    ret.then(Backery.Promise.resolve(object));
            } else {
                return Backery.Promise.resolve(object);
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

    self.getSubApplications = function() {
        return _extensionsRunner.getSubApplications();
    }

    self.getCookiePrivateKey = function() {
        return _nconf.get('oauth2:cookie_private_key');
    }

    var _backeryPackageJSON = require(__dirname + '/../package.json');
    var _extensionPackageJSON = require(path.dirname(path.resolve(_nconf.get('paths:extension-code'))) + '/package.json');
    self.getStatusObject = function() {
        return {
            application: {
                name: self.getName(),
                extension: {
                    version: _extensionPackageJSON.version
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

    self.processRequest = function(request) {
        if (request.getValidationError()) {
            return self.Backery.Promise.reject(request.getValidationError());
        } else {
            if (request.type != 'CustomEndpoint') {
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
                // Custom endpoints are always processed by extensions code
                return new self.Backery.Promise(function(resolve, reject) {
                    _extensionsRunner.processEndpoint(request.method, request.endpoint,
                        request, new ExtensionResponse(resolve, reject));
                });
            }
        }
    }

    // Mailer
    if (_nconf.get('mailer:type')) {
        var mailerType = _nconf.get('mailer:type');
        var _mailer;
    
        if (mailerType == 'smtp') {
            _mailer = new SMTPMailer(_nconf.get('mailer:config'), Backery);
        }
    
        Object.defineProperty(this, 'mailer', { get: function() { return _mailer; } });
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
                'Someone, hopefully you, has requested that your password for ' + self.getName() + ' be reset.\n' +
                'Please copy the following url into your browser to complete the password reset process.\n\n' +
                'http' + (nconf.get('http:publicHost:ssl') ? 's' : '') + '://' + nconf.get('http:publicHost:name') +
                    (nconf.get('http:publicHost:port') ? ':' + nconf.get('http:publicHost:port') : '') + '/web/reset-password/?token=' + token + '\n\n'
                'Thank you';
        
            return self.mailer.sendMail({
                from: _nconf.get('mailer:from'),
                to: email,
                subject: self.getName() + ': Reset Password',
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
                user.set('password', password);
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
        } else {
           reject(new Error('Default file manager is not defined'));
        }
    
        if (nconf.get('pushNotifications')) {
            pushNotificationsSender = new PushNotificationsSender(nconf.get('pushNotifications'), entities,
                pushNotificationsQueue, Backery);
            pushNotificationsSender.start();
        }
    
        Backery.Model = entities;
    
        if (database.SQL) {
            Backery.SQL = database.SQL;
        }
    
        // Wrap functions that require database with wrappers, providing database object
        Backery.Struct.fromJSON = _.partial(Backery.Struct.fromJSON, _, _, database);
        Backery.Object.load = _.partial(Backery.Object.load, _, database);
        Backery.Push.send = _.partial(Backery.Push.send, _, _, pushNotificationsQueue);
    
        return Backery.Promise.resolve(new Application(nconf, database, Backery));
    });
};
