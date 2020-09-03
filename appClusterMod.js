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
//Clusters
const cluster = require('cluster');
const os = require('os');
console.log("numCPUs: ",os.cpus().length);
console.log("totalMem: ",os.totalmem());
// Fork workers.
if (cluster.isMaster) {
    for (let i = 0; i < os.cpus().length; i++) {
        cluster.fork();
        console.log("fork cpu core num: ",i);
    }
    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
}  else {
        // Workers can share any TCP connection
        // In this case it is an HTTP server





    //SSL
    /*var options = {
        key: fs.readFileSync('./ssl/server.key', 'utf8'),//privatekey.pem
        cert: fs.readFileSync('./ssl/server.crt', 'utf8'),//certificate.pem
    };*/

    var app = express();
    app.set('port', config.get('port'));
    app.disable('x-powered-by');

    //webPack
    var webpack = require('webpack');
    var devMiddleware = require('webpack-dev-middleware');
    var configWP;
    if(config.get('dev')) {
        console.log('Express server run at devMod');
        configWP = require('./config/webpack.dev.config.js');
        var webpackHRM = require('webpack-hot-middleware');
    } else {
        console.log('Express server run at prodMod');
        configWP = require('./config/webpack.prod.config.js');
    }
    var compiler = webpack(configWP);
    app.use(devMiddleware(compiler, {
        noInfo: true,
        publicPath:  configWP.output.publicPath,
    }));
    if(config.get('dev')) app.use((webpackHRM)(compiler));
    ////
    app.use(favicon());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    //app.use(cookieParser(""));
    app.use(session({
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
    app.use(express.static(path.join(__dirname, './public')));
    app.use('/*', function (req, res, next) {
        var filename = path.join(compiler.outputPath,'index.html');
        console.log('index filename path: ', filename);
        compiler.outputFileSystem.readFile(filename, function(err, result){
            if (err) {
                return next(err);
            }
            res.set('content-type','text/html');
            res.send(result);
            res.end();
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
    console.log(`Worker ${process.pid} started`);
}





