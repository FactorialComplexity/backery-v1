var apn = require('apn');
var _ = require('lodash');
var fcm = require('./services/fcm');

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
                        .and(Backery.NotEq('environment', null))
                        .find()
                        .then(function(installations) {
                            _.each(installations, function(installation) {
                                var payload = notification.payload;
                                // Check if this installation has apns token
                                if (installation.get('apnsToken') != null) {
                                    
                                    var apnsConnection = self.apns[installation.get('environment')];
                                    
                                    if (apnsConnection) {
                                        
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
                                        
                                        try {
                                            apnsConnection.pushNotification(apnsNotification, recipientDevice);
                                        } catch (error) {
                                            console.error('Failed to send notification to APNS environment `' + installation.get('environment') +
                                        '`: environment not configured', error);
                                        }
                                        
                                        console.log('APNS SENT (' + installation.get('environment') + '-' + installation.get('apnsToken')  + '): '+
                                            apnsNotification.compile());
                                    } else {
                                        console.error('Failed to send notification to APNS environment `' + installation.get('environment') +
                                        '`: environment not configured');
                                    }
                                }
                                
                                if (installation.get('gcmToken') != null) {
                                    
                                    var fcmToken = installation.get('gcmToken');
                                    
                                    var message = {
                                        android: {
                                            notification: {
                                                title: payload.fcm.title != undefined ? payload.fcm.title : '',
                                                titleLocKey: payload.fcm.titleLocKey != undefined ? payload.fcm.titleLocKey : '',
                                                titleLocArgs: payload.fcm.titleLocArgs != undefined ? payload.fcm.titleLocArgs : '',
                                                body: payload.fcm.body != undefined ? payload.fcm.body : '',
                                                bodyLocKey: payload.fcm.bodyLocKey  != undefined ? payload.fcm.bodyLocKey : '',
                                                bodyLocArgs: payload.fcm.bodyLocArgs != undefined ? payload.fcm.bodyLocArgs : '',
                                            },
                                        },
                                        data: {},
                                        token: fcmToken
                                    };

                                    for (var key in payload) {
                                        if (key != 'apns' && key != 'fcm') {
                                            message.data[key] = payload[key];
                                        }
                                    }
                                    
                                    try {
                                        fcm.sendMessage(message);
                                    } catch (error) {
                                        console.log('Failed to send notification to FCM', error);
                                    }
                                }
                            });
                        });
                    
                })).then(function() {
                    self._processing = false;
                }).catch(function(error) {
                    console.error(error);
                    self._processing = false;
                });
            });
        }
    }, self.config.loopInterval);
}

module.exports = PushNotificationsSender;