var apn = require('apn');
var _ = require('lodash');

var PushNotificationsSender = function(config, entities, queue, Backery) {
    this.config = config;
    this.entities = entities;
    this.queue = queue;
    this.Backery = Backery;
    this.apns = { };
    
    var self = this;
    _.each(config.environments.ios, function(env, key) {
        self.apns[key] = new apn.Connection(env);
        if (!self.apns[key]) {
            console.error('Failed to initialize APNS for environment: ', env);
        }
        self._listenForFeedback(env);
    });
}

PushNotificationsSender.prototype._listenForFeedback = function(env) {
    var Installation = this.entities.Installation;

    env.interval = 3600;
    env.batchFeedback = false;
    var apnsFeedback = new apn.Feedback(env);

    if (apnsFeedback) {
        apnsFeedback.on('feedback', function(time, device) {
            Installation.query().where('apnsToken', device.toString()).findOne().then(function(installation) {
                if (installation) {
                    installation.set('apnsToken', null);
                    installation.save();
                }
            });
        });

        apnsFeedback.on('feedbackError', function(error) {
            console.log('Feedback Error', error);
        });

        apnsFeedback.on('error', function(error) {
            console.log('Error', error);
        });
    }
}

PushNotificationsSender.prototype.start = function() {
    var self = this;
    var Installation = this.entities.Installation;
    var Backery = this.Backery;
    
    
    setInterval(function() {
        if (!self._processing) {
            self._processing = true;
            self.queue.dequeue(self.config.numberToProcessAtOnce, function(notifications) {
                
                Backery.Promise.all(_.map(notifications, function(notification) {
                    return Installation.query()
                        .where(notification.whereInstallation)
                        .and('platform', 'ios')
                        .and(Backery.NotEq('apnsToken', null))
                        .and(Backery.NotEq('environment', null))
                        .find()
                    .then(function(installations) {
                        _.each(installations, function(installation) {
                            var apnsConnection = self.apns[installation.get('environment')];
                            
                            if (apnsConnection) {
                                var payload = notification.payload;
                                var apnsNotification = new apn.Notification();
                                var recipientDevice = new apn.Device(installation.get('apnsToken'));
                                
                                if (payload.apns) {
                                    apnsNotification.expiry = payload.apns.expiry;
                                    apnsNotification.priority = payload.apns.priority;
                                    apnsNotification.badge = payload.apns.badge;
                                    apnsNotification.sound = payload.apns.sound;
                                    apnsNotification.alert = payload.apns.alert;
                                    apnsNotification.category = payload.apns.category;
                                    apnsNotification.contentAvailable = payload.apns.contentAvailable;
                                    apnsNotification.mdm = payload.apns.mdm;
                                    apnsNotification.topic = self.config.bundleId;
                                    
                                    if (payload.apns.actionLocKey) {
                                        apnsNotification.setActionLocKey(payload.apns.actionLocKey);
                                    }
                                    
                                    if (payload.apns.locKey) {
                                        apnsNotification.setLocKey(payload.apns.locKey);
                                    }
                                    
                                    if (payload.apns.locArgs) {
                                        apnsNotification.setLocArgs(payload.apns.locArgs);
                                    }
                                    
                                    if (payload.apns.launchImage) {
                                        apnsNotification.setLaunchImage(payload.apns.launchImage);
                                    }
                                    
                                } else {
                                    apnsNotification.contentAvailable = true;
                                }
                                
                                _.each(payload, function(value, key) {
                                    if (key != 'apns' && key != 'gcm') {
                                        apnsNotification.payload[key] = value;
                                    }
                                });
                                
                                apnsConnection.pushNotification(apnsNotification, recipientDevice);
                                
                                console.log('APNS SENT (' + installation.get('environment') + '-' + installation.get('apnsToken')  + '): '+
                                    apnsNotification.compile());
                            } else {
                                console.error('Failed to send notification to APNS environment `' + installation.get('environment') +
                                    '`: environment not configured');
                            }
                        });
                    });
                    
                })).then(function() {
                    self._processing = false;
                }).catch(function(error) {
                    console.error(error);
                });
            });
        }
    }, self.config.loopInterval);
}

module.exports = PushNotificationsSender;
