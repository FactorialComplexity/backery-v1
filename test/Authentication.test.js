var should = require('should');
var _ = require('lodash');

var mock_authentication = require('./mock/mock_authentication.test.js');
var mock_BackeryObject = require('./mock/mock_BackeryObject.js');

describe('Authentication', function() {
    var config = {
        oauth2: {
            clients: {
                client1: 'secret1',
                client2: 'secret2'
            },
            tokensLifetime: {
                accessToken: 3600,
                refreshToken: 1209600
            }
        }
    };
    
    var schema = {
        "authMethods": [
            { "method": "facebook" },
            { "method": "twitter" },
            { "method": "google" },
            { "method": "password", "loginFields": [ "email" ], "passwordRecoveryEmailField": "email" }
        ],
    
        "entities": [
            {
                "name": "User",
                "fields": [
                    { "name": "email", "type": { "name": "String", "limit": 40 } }
                ]
            },
        ]
    };
    
    var mock = mock_authentication(config, schema);
    
    var auth = mock.auth;
    var Backery = mock.Backery;
    
    describe('#hasOAuth2Client()', function() {
        it('should return true if client id and secret are correct', function() {
            auth.hasOAuth2Client('client1', 'secret1').should.be.true();
        });
        
        it('should return false if client id is unknown', function() {
            auth.hasOAuth2Client('uknownClient', 'secret1').should.be.false();
        });
        
        it('should return false if client secret is invalid', function() {
            auth.hasOAuth2Client('client1', 'invalidSecret').should.be.false();
        });
    });
    
    describe('#createAccessToken(), #getAccessToken()', function() {
        var createdAccessToken;
        
        it('should create new access token and save to the database for a further retrieval', function() {
            return auth.createAccessToken('client1', mock_BackeryObject({ id: '123' })).then(function(accessToken) {
                accessToken.token.should.be.ok();
                accessToken.token.should.be.a.String();
                accessToken.expiresIn.should.be.exactly(config.oauth2.tokensLifetime.accessToken);
                
                createdAccessToken = accessToken.token;
            });
        });
    
        it('should return valid access token object if correct access token was specified', function() {
            return auth.getAccessToken(createdAccessToken).then(function(token) {
                token.token.should.be.exactly(createdAccessToken);
                token.expires.should.be.a.Date();
                token.user.objectId().should.be.exactly('123');
            });
        });
        
        it('should return falsy value if access token was not found', function() {
            return auth.getAccessToken('accessTokenInvalid').then(function(token) {
                should(token).not.be.ok();
            });
        });
    });
    
    describe('#createRefreshToken(), #getRefreshToken()', function() {
        var createdRefreshToken;
        
        it('should create new refresh token and save to the database for a further retrieval', function() {
            return auth.createRefreshToken('client1', mock_BackeryObject({ id: '123' })).then(function(token) {
                should(token).be.ok();
                token.should.be.a.String();
                
                createdRefreshToken = token;
            });
        });

        it('should return valid refresh token object if correct refresh token string was specified', function() {
            return auth.getRefreshToken(createdRefreshToken).then(function(token) {
                token.token.should.be.exactly(createdRefreshToken);
                token.expires.should.be.a.Date();
                token.user.objectId().should.be.exactly('123');
            });
        });
        
        it('should return falsy value if refresh token was not found', function() {
            return auth.getAccessToken('refreshTokenInvalid').then(function(token) {
                should(token).not.be.ok();
            });
        });
    });
    
    describe('#authenticateUser()', function() { 
        before(function() {
            mock.users = [
                {
                    id: '1',
                    email: 'test@example.com',
                    password: '123'
                },
                
                {
                    id: '2',
                    email: 'test2@example.com',
                    password: '1234',
                    blocked: true
                }
            ];
        });
        
        it('should return consistency error for not supported method', function() {
            return auth.authenticateUser('unknown').should.be.rejectedWith({ code: 'ConsistencyError' });
        });
        
        it('should return User if correct username and password were provided', function() {
            return auth.authenticateUser('password', { username: 'email:test@example.com', password: '123'})
                .should.be.fulfilled().then(function(user) {
                
                user.get('email').should.be.exactly('test@example.com');
            });
        });
        
        it('should fail with InvalidCredentialsError if incorrect email was provided', function() {
            return auth.authenticateUser('password', { username: 'email:invalid@example.com', password: '123'})
                .should.be.rejectedWith({ code: 'InvalidCredentialsError' });
        });
        
        it('should fail with InvalidCredentialsError if incorrect password was provided', function() {
            return auth.authenticateUser('password', { username: 'email:test@example.com', password: 'invalid'})
                .should.be.rejectedWith({ code: 'InvalidCredentialsError' });
        });
        
        it('should fail with UserIsBlocked if valid credentials were provided, but user is blocked', function() {
            return auth.authenticateUser('password', { username: 'email:test2@example.com', password: '1234'})
                .should.be.rejectedWith({ code: 'UserIsBlocked' });
        });
        
        it('should fail with InvalidCredentialsError if incorrect password was provided, and user is blocked', function() {
            return auth.authenticateUser('password', { username: 'email:test2@example.com', password: 'invalid'})
                .should.be.rejectedWith({ code: 'InvalidCredentialsError' });
        });
        
        it('should return User who was previosly registered with valid Facebook token', function() {
            return auth.authenticateUser('facebook', { facebook_access_token: 'validFacebookTokenForExistingUser' })
                .should.be.fulfilled().then(function(user) {
                
                user.objectId().should.be.exactly('validUserId');
            });
        });
        
        it('should create and return new User when providing a valid Facebook token for user not previosly registered', function() {
            return auth.authenticateUser('facebook', { facebook_access_token: 'validFacebookTokenForNotExistingUser' })
                .should.be.fulfilled().then(function(user) {
                
                user.objectId().should.be.exactly('validUserId');
            });
        });
        
        it('should fail with UnauthorizedError, when invalid Facebook token was provided', function() {
            return auth.authenticateUser('facebook', { facebook_access_token: 'invalidFacebookToken' })
                .should.be.rejectedWith({ code: 'UnauthorizedError' });
        });
        
        it('should return User who was previosly registered with valid Twitter token', function() {
            return auth.authenticateUser('twitter', {
                twitter_access_token: 'validTwitterTokenForExistingUser',
                twitter_access_token_secret: 'validTwitterTokenSecret'
            }).should.be.fulfilled().then(function(user) {
                user.objectId().should.be.exactly('validUserId');
            });
        });
        
        it('should create and return new User when providing a valid Facebook token for user not previosly registered', function() {
            return auth.authenticateUser('twitter', {
                twitter_access_token: 'validTwitterTokenForNotExistingUser',
                twitter_access_token_secret: 'validTwitterTokenSecret'
            }).should.be.fulfilled().then(function(user) {
                user.objectId().should.be.exactly('validUserId');
            });
        });
        
        it('should fail with UnauthorizedError, when invalid Twitter token was provided', function() {
            return auth.authenticateUser('twitter', {
                twitter_access_token: 'invalidTwitterToken',
                twitter_access_token_secret: 'invalidTwitterTokenSecret'
            }).should.be.rejectedWith({ code: 'UnauthorizedError' });
        });
        
        it('should return User who was previosly registered with valid Facebook token', function() {
            return auth.authenticateUser('google', { google_id_token: 'validGoogleTokenForExistingUser' })
                .should.be.fulfilled().then(function(user) {
                
                user.objectId().should.be.exactly('validUserId');
            });
        });
        
        it('should create and return new User when providing a valid Facebook token for user not previosly registered', function() {
            return auth.authenticateUser('google', { google_id_token: 'validGoogleTokenForNotExistingUser' })
                .should.be.fulfilled().then(function(user) {
                
                user.objectId().should.be.exactly('validUserId');
            });
        });
        
        it('should fail with UnauthorizedError, when invalid Google token was provided', function() {
            return auth.authenticateUser('google', { google_id_token: 'invalidFacebookToken' })
                .should.be.rejectedWith({ code: 'UnauthorizedError' });
        });
    });
});
