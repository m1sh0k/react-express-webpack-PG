var fs = require('fs');
var User = require('../db/models/index').User;
var Message = require('../db/models/index').Message;
var HttpError = require('./../error').HttpError;
var AuthError = require('./../error').AuthError;
var DevError = require('./../error').DevError;
var config = require('../../config');
var path = require('path');
let Buffer = require('buffer').Buffer;
//Add eventEmitter
var common = require('../common').commonEmitter;
//multer
const multer  = require("multer");
//send email
let sE = require('./mailer').sendMail;
//console.log("send email function: ",sE)
const ip = require('ip');
//console.log('Express server listening on ip:',ip.address(),',port:',config.get('port'));


function checkName(name){
    const a = /[ !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
    return name.match(a);
}

function checkPass(pass){
    const a = /^\s+$/;
    return pass.match(a);
}

function checkEmail(email){
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return !re.test(String(email).toLowerCase());
}

module.exports = function(app) {

    app.post('/login', async function(req, res, next) {
        try {
            console.log('/login username: ', req.body.username,' /login password: ',req.body.password);
            var username = req.body.username;
            var password = req.body.password;
            if(!username || !password) return next(new HttpError(403, 'incorrect request'));
            let {err,user} = await User.authorize({username:username,password:password});
            if(err) {
                if(err instanceof AuthError) return next(new HttpError(403, err.message))
                else return next(err);
            };
            console.log('/login user._id: ', user._id);
            req.session.user = user._id;
            console.log('/login req.session.user: ', req.session.user);
            res.send({user});
        } catch(err) {
            console.log('/login err: ',err);
            return next(err);
        }
    });

    app.post('/register', async function(req, res, next) {
        try {
            console.log('/register username: ', req.body.username,' /register password: ',req.body.password);
            var username = req.body.username;
            var password = req.body.password;
            if(!username || !password) return next(new HttpError(403, 'Invalid data request.'));
            let user = await User.findOne({where: {username:username}});
            if(!user) {
                user = await User.create({ username: username, password: password });
                console.log('/register user: ', user);
                req.session.user = user._id;
                res.send({user});
            } else {
                return next(new HttpError(403, "Name is already exist!"))
            }

        } catch(err) {
            console.log('/register err: ',err);
            return next(err);
        }
    });


    app.post('/logout', function(req,next) {
        console.log("/logout");
        var sid = req.sessionID;
        req.session.destroy();
        console.log('/logout req.sessionID: ',sid);
        common.emit('session:reload',sid,(err)=>{if(err) return next(err)});//Internal Node emit to socketIo session:reload
    });

    var checkAuthAdmin = function(req, res, next) {
        console.log("checkAuthAdmin: ", req.session);
        console.log("config.get('AdministratorId'): ",config.get('AdministratorId'));
        if (!config.get('AdministratorId').includes(req.session.user)) {
            return next(new HttpError(401, "you are not authorized like Administrator"));
        }
        next();
    };

    app.post('/users',checkAuthAdmin,async function(req, res, next) {
        try {
            if(req.body.usersArray) {
                var willDelete = req.body.usersArray;
                console.log("users for deleting: ", willDelete);
                willDelete.forEach(function(id) {
                    if (id != config.get('AdministratorId')) {
                        console.log('users for deleting id: ',id);
                        User.deleteOne({ _id: id }, function (err) {
                            if (err) return next (err)
                        });
                    };
                });
                let users = await User.findAll();
                console.log('/users: ', users);
                res.json(users)
            } else {
                let users = await User.findAll();
                console.log('/users: ', users);
                res.json(users)
            }
        } catch(err){
            console.log('getUsers err: ',err)
        }
    });

    app.post('/checkName',async function (req, res) {
        var newUsername = req.body.newUsername;
        console.log('/checkName newUsername: ',newUsername);
        let user = await User.findOne({where:{username:newUsername}});
        if (!user) {
            res.sendStatus(200)
        } else res.sendStatus(403);
    });
    ///updateUserdata
    app.post('/updateUserdata', async function(req, res, next) {
        try {
            let userSesId = req.session.user;
            console.log('userSes: ', userSesId);
            if(!userSesId) return next(new  HttpError(401, 'Anonymous session unable to connect.'));
            let user = await User.findOne({where:{_id:userSesId}});
            res.send({user});
        } catch (err) {
            console.log('/changeUserData err: ',err);
            return next(err);
        }
    });

    app.post('/changeUserData', async function(req, res, next) {
        try {
            let userSesId = req.session.user;
            console.log('userSes: ', userSesId);
            if(!userSesId) return next(new  HttpError(401, 'Anonymous session unable to connect.'));
            let getUser = await User.findOne({where:{_id:userSesId}});
            console.log('/changeUserData, req.body: ',req.body);
            let newUsername = req.body.username.length === 0 ? null : req.body.username;
            let newPassword = req.body.password.length === 0 ? null : req.body.password;
            let oldPassword = req.body.oldPassword;
            console.log('/changeUserData, newUsername: ',newUsername,',','newPassword: ',newPassword,',','OldPassword: ',oldPassword);
            if(newUsername !== null && checkName(newUsername)) return next(new HttpError(403, "Invalid new username name."));
            if(newPassword !== null && checkPass(newPassword)) return next(new HttpError(403, "Invalid new password."));


            if(!newUsername && !newPassword) return next(new HttpError(403, "Not fool request for changing user data."));
            if(!oldPassword) return next(new HttpError(403, "Not fool request for changing user data. Forgot type old password"));

            let {err,user} = await User.changeData({
                _id:userSesId,
                newUsername:newUsername,
                newPassword:newPassword,
                oldPassword:oldPassword,
                oldUsername:getUser,
            });
            if(err) {
                if(err instanceof AuthError) return next(new HttpError(403, err.message))
                else return next(err);
            };
            console.log('/login newUser: ', user);
            req.session.user = user._id;
            res.send({user});
            common.emit('changeUserName',newUsername,(err)=>{if(err) return next(err)});//Internal Node emit to socketIo changeUserName
        } catch (err) {
            console.log('/changeUserData err: ',err);
            return next(err);
        }
    });

    app.post('/addEmail', async function(req,res,next){
        try {
            let newEmail = req.body.email
            console.log('/addEmail: ', newEmail);
            if(!newEmail && checkEmail(newEmail)) return next(new HttpError(403, "Invalid new email."));
            let userSesId = req.session.user;
            console.log('userSes: ', userSesId);
            if(!userSesId) return next(new  HttpError(401, 'Anonymous session unable to connect.'));
            let getUser = await User.findOne({where:{_id:userSesId}});
            if(newEmail === getUser.email) return next(new  HttpError(401, 'You have already set this email. Confirm it or enter a new one.'));
            await sE({
                to: newEmail,
                subject: "CatChat email registration",
                text: "You are receive this email because try add email to you CatChat account data. Click to link below to complete registration new email address!",
                html: `<link>https://${ip.address()}:${config.get('port')}/emailConfirm/${newEmail}</link>`,
            })
            await User.update({
                    "email":newEmail//set email,after need change emailConfirm: true,
                },
                {where:{_id:userSesId}});
            let user = await User.findOne({where:{_id:userSesId}});
            res.send({user});
        } catch(err) {
            console.log('/addEmail err: ',err);
            if(err.code === 'EAUTH') return next(new DevError("Email could not sent due to error: "+err))
            return next(err);
        }
    })

    app.post('/removeEmail', async function(req,res,next){
        try {
            let userSesId = req.session.user;
            console.log('userSes: ', userSesId);
            if(!userSesId) return next(new  HttpError(401, 'Anonymous session unable to connect.'));
            await User.update({
                    "email":null,
                    "emailConfirmed":false,
                },
                {where:{_id:userSesId}});
            let user = await User.findOne({where:{_id:userSesId}});
            res.send({user});
        } catch(err) {
            console.log('/addEmail err: ',err);
            return next(err);
        }
    })

    app.get('/emailConfirm/:email',async function(req,res,next){
        try{
            let email = req.params.email;
            console.log("emailConfirm email: ",email);
            await User.update({
                    "emailConfirmed":true
                },
                {where:{email:email}});
            res.send("You have successfully verified your email. Close this tab and refresh the settings page.");
        }catch(err){
            console.log('/emailConfirm:email err: ',err);
            return next(err);
        }
    })
    //multer uploader
    const storage = multer.diskStorage({
        destination: function (req, file, callback) {
            callback(null, 'uploads/');
        },
        filename: function (req, file, callback) {
            callback(null, file.originalname + '.' + file.mimetype.split('/')[1]);
        }
    });

    function imageFilter(req, file, cb){
        if (file.mimetype.startsWith("image")) {
            cb(null, true);
        } else {
            cb("Please upload only images.", false);
        }
    };

    const upload = multer({ storage:storage, fileFilter: imageFilter});
    //read file
    function readBinary(fileLink){
        return new Promise((resolve, reject) => {
            fs.readFile(fileLink,(err,data)=>{
                if(err) reject(err)
                else resolve(data);
            });

        });
    }

    function streamReadBinary(fileLink){
        let stream = new fs.ReadStream(fileLink);
        return new Promise((resolve, reject) => {
            let dataBuf = [];
            stream.on("data", chunk => dataBuf.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(dataBuf)));
            stream.on("error", err => reject(err));
        });
    }

    app.post('/changeUserImg',upload.single('image'), async function(req, res, next) {
        try {
            //console.log('/changeUserImg req: ',req);
            let userSesId = req.session.user;
            console.log('userSes: ', userSesId);
            let fileData = req.file;
            let fileName = fileData.originalname + '.' + fileData.mimetype.split('/')[1];
            let fileLink = './uploads/'+fileName;
            console.log('fileLink: ', fileLink);
            let binaryFileData;
            console.log('filedata: ',fileData);
            if(!fileData){
                res.sendStatus(400);
            }
            else{
                binaryFileData = await readBinary(fileLink);
                //for big file
                //await streamReadBinary(fileName)
                // console.log("binaryFileData before write to DB: ",binaryFileData);
                // console.log("binaryStreamFileData: ",await streamReadBinary(fileName));
                if(!binaryFileData) return next("Binary data file undefined!");
                await User.update({
                        "avatar":binaryFileData//binaryFileData,
                    },
                    {where:{_id:userSesId}});
                await fs.promises.unlink(fileLink);
                let user = await User.findOne({where:{_id:userSesId}});
                console.log("changeUserImg user: ",user);
                res.send({user});
            }
        } catch (err) {
            console.log('/changeUserImg err: ',err);
            return next(err);
        }
    });

    function setGetSig(arr) {
        arr.sort();
        return arr[0] + '_' + arr[1];
    }

    app.post('/deleteAccount', async function(req, res, next) {

        try {
            let userName = req.body.deleteUsername;
            let checkPass = req.body.checkPass;
            if(!userName || !checkPass) return next(new HttpError(403, "Not fool request for deleting account!"));
            console.log('/deleteAccount, userName: ',userName,',','checkPass: ',checkPass);
            let user = await User.findOne({where:{username:req.body.deleteUsername}});
            if(!user.checkPassword(req.body.checkPass)) return next(new HttpError(403, "Password is incorrect"));
            console.log('deleteAccount user: ',user);
            let cont = [...user.contacts,...user.blockedContacts];
            for (let name of cont) {
                let user = await User.findOne({where: {username:name}});
                //await Message.update({"status" : true},{where:{_id:idx}});
                await User.update({
                    "contacts":user.contacts.filter(itm => itm !== userName),
                    "blockedContacts":user.blockedContacts.filter(itm => itm !== userName),
                    },
                    {where:{username:name}});
                await Message.destroy({where: {uniqSig: setGetSig([userName,name])}});
            }
            await User.destroy({where: {_id: user._id}});
            req.session.user = user._id;
            res.send({user});
        } catch (err) {
            console.log('/deleteAccount err: ',err);
            return next(err);
        }
    });

};

