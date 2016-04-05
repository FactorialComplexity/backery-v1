var AWS = require('aws-sdk');
var _ = require('underscore');

var fs = require('fs');

var S3FileManger = function(options, Backery) {
    
    AWS.config.update({
        accessKeyId: options['awsKey'],
        secretAccessKey: options['awsSecret']
    });
    
    this.s3 = new AWS.S3();
    this.bucket = options['bucket'];
    this.prefix = options['prefix'] || '';
    this.Backery = Backery;
    this.name = 's3';
}

S3FileManger.prototype.getName = function() {
  return this.name;
}

S3FileManger.prototype.upload = function(file_path, key, options) {
    var self = this;
    return new self.Backery.Promise(function(resolve, reject) {
        var storage = {key: key, prefix: self.prefix};
        
        self.s3.upload({
            Bucket: self.bucket,
            ACL: 'public-read',
            Key: self.prefix + '/' + key,
            ContentType: options.content_type,
            Body: _.isString(file_path) ? fs.createReadStream(file_path) : file_path
        }).send(function(error, data) {
            if (error) {
                reject(new Error('Cannot upload file to S3' + error));
                return;
            }
            resolve(storage);
        });
    }, function(error) {
        reject(new Error('Cannot upload file to S3' + error));
    });
}

S3FileManger.prototype.delete = function(storage) {
    var self = this;
    return new self.Backery.Promise(function(resolve, reject) {
        self.s3.deleteObject({
            Bucket: self.bucket,
            Key: storage['prefix'] + '/' + storage['key'],
        }).send(function(error, data) {
          if (error) {
              reject(new Error('Cannot delete file from S3' + error));
              return;
          }
          resolve();
        });
    }, function(error) {
        reject(new Error('Cannot delete file from S3' + error));
    });
}

S3FileManger.prototype.getUrl = function(options) {
    //return this.s3.getSignedUrl('getObject', { Bucket: this.bucket, Key: key });
    return 'https://' + this.bucket + '.s3.amazonaws.com/' + options['prefix'] + '/' + options['key'];
}

module.exports = S3FileManger;