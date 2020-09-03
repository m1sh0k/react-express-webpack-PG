var express = require('express');
var http = require('http');
var https = require('https');
var path = require('path');
var config = require('./config');
var favicon = require('static-favicon');
var bodyParser = require('body-parser');
var routes = require('./middleware/routes');
var errorHandler = require('./middleware/errorHandler');
var io = require('./middleware/socket');
var session = require('express-session');
var sessionStore = require('./middleware/db/sessionStore');
var ip = require('ip');
var fs = require('fs');

//SSL
/*var options = {
    key: fs.readFileSync('./ssl/server.key', 'utf8'),//privatekey.pem
    cert: fs.readFileSync('./ssl/server.crt', 'utf8'),//certificate.pem
};*/

var app = express();
app.set('port', config.get('port'));
app.disable('x-powered-by');

app.use(favicon());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
//app.use(cookieParser(""));

app.use(session({
    connections: config.get('pg'),
    secret: config.get('session:secret'),
    resave: config.get('session:resave'),
    saveUninitialized: config.get('session:saveUninitialized'),
    key: config.get('session:key'),
    cookie: config.get('session:cookie'),
    store: sessionStore
}));
app.use(require('./middleware/db/loadUser'));

//Routes
routes(app);
app.use(express.static(path.join(__dirname, './public/prod')));
app.use('/*', function (req, res, next) {
    var filename = path.join(__dirname, './public/prod/index.html');
    console.log('index filename path: ', filename);
    res.sendFile(filename,(err)=>{
        if (err) {
            return next(err);
        }
    });
});
//Error Handler middleware
errorHandler(app);
//Create Server
var server = http.createServer(app);
//var server = https.createServer(options,app);
server.listen(config.get('port'), function(){
    console.log('Express server listening on ip:',ip.address(),',port:',config.get('port'));
});
//socket
io(server);





