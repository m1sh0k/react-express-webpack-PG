
var HttpError = require('./error').HttpError;
//var DevError = require('./error').DevError;


module.exports = function(app) {
    app.use(function (err, req, res, next) {
        if(err instanceof HttpError) {
            console.log("HttpError: ", err);
            res.status(err.status);
            res.send(err);
        }
        else {
            if (app.get('env') === 'development') {
                err = {status:500,message:err.toString()};
                console.log("DevError: ", err);
                res.status(err.status || 500);
                res.send(err);
            }
            else{
                console.log("UnKnowDevError: ", err);
                err = {status:500,message:err.toString()};
                res.status(err.status || 500);
                res.send(err);
            }
        }
    });
};


