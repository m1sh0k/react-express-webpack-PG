var path = require('path');
var util = require('util');
var http = require('http');

function HttpError(status, message) {
    console.log("HttpError error done status: ",status,", message: ",message);
    Error.apply(this, arguments);
    Error.captureStackTrace(this, HttpError);
    this.status = status;
    this.message = message || http.STATUS_CODES[status] || "Error";
}

util.inherits(HttpError, Error);
HttpError.prototype.name = 'HttpError';
exports.HttpError = HttpError;

function AuthError(message) {
    console.log("AuthError error done message: ",message);
    Error.apply(this, arguments);
    Error.captureStackTrace(this, AuthError);
    this.message = message;
}
util.inherits(AuthError, Error);
AuthError.prototype.name = 'AuthError';
exports.AuthError = AuthError;

function DevError(message) {
    console.log("DevError error done message: ",message);
    Error.apply(this, arguments);
    Error.captureStackTrace(this, DevError);
    this.message = message;
}
util.inherits(DevError, Error);
DevError.prototype.name = 'DevError';
exports.DevError = DevError;