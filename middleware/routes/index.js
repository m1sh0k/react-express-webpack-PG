var fs = require('fs');
var User = require('../db/models/index').User;
var Message = require('../db/models/index').Message;
var HttpError = require('./../error').HttpError;
var AuthError = require('./../error').AuthError;
var config = require('../../config');
var path = require('path');
//Add eventEmitter
var common = require('../common').commonEmitter;



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
            if(!username || !password) return next(new HttpError(403, 'incorrect request'));
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
            console.log('/login err: ',err);
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
        if (req.session.user != config.get('AdministratorId')) {
            return next(new HttpError(401, "you are not authorized like Administrator"));
        }
        next();
    };

    app.post('/users',checkAuthAdmin,async function(req, res, next) {
        function find() {
            console.log('function find()');
            User.find({}, function (err, users) {
                if(err) return next(err);
                res.json(users);
            })
        }
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
            find();
        } else {find()}

    });

    app.post('/checkName',async function (req, res) {
        var newUsername = req.body.newUsername;
        console.log('/checkName newUsername: ',newUsername);
        let user = await User.findOne({username:newUsername});
        if (!user) res.send({})
        else res.send({user});
    });

    app.post('/changeUserData', async function(req, res, next) {
        try {
            let oldUsername = req.body.oldUsername;
            let newUsername = req.body.username;
            let newPassword = req.body.password;
            let oldPassword = req.body.oldPassword;
            console.log('/changeUserData, oldUsername: ',oldUsername,',','newUsername: ',newUsername,',','newPassword: ',newPassword,',','OldPassword: ',oldPassword);
            if(!newUsername || !newPassword || !oldUsername || !oldPassword) return next(new HttpError(403, "Not fool request for changing user data"));
            let {err,user} = await User.changeData({oldUsername:oldUsername,newUsername:newUsername,newPassword:newPassword,oldPassword:oldPassword});
            if(err) {
                if(err instanceof AuthError) return next(new HttpError(403, err.message))
                else return next(err);
            };
            console.log('/login newUser: ', user);
            req.session.user = user._id;
            res.send({user});
        } catch (err) {
            console.log('/login err: ',err);
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

