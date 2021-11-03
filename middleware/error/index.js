var http = require('http');


class HttpError extends Error {
    constructor (status, message) {
        super();
        console.log("HttpError error done, status: ",status,", message: ",message);
        this.name = 'HttpError';
        this.status = status;
        this.message = message || http.STATUS_CODES[status] || "Error";
        Error.captureStackTrace(this, HttpError);
    }
}
module.exports.HttpError = HttpError;

class AuthError extends Error {
    constructor ( message) {
        super();
        console.log("AuthError error done, message: ",message);
        this.name = 'AuthError';
        this.message = message;
        Error.captureStackTrace(this, AuthError);
    }
}
module.exports.AuthError = AuthError;

class DevError extends Error {
    constructor ( message) {
        super();
        console.log("Internal server error done, message: ",message);
        this.name = 'DevError';
        this.message = "Internal server error." + message;
        Error.captureStackTrace(this, DevError);
    }
}

module.exports.DevError = DevError;

