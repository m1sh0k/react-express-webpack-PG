var config = require('./../../config');
var cookie = require('cookie');
var sessionStore = require('../db/sessionStore');
var HttpError = require('./../error/index').HttpError;
var DevError = require('./../error/index').DevError;
var User = require('../db/models/index').User;
var Message = require('../db/models/index').Message;
var Room = require('../db/models/index').Room;
var MessageData = require('../db/models/index').MessageData;
var globalChatUsers = {};
var common = require('../common').commonEmitter;
const { Op } = require("sequelize");





function getConSid(a) {
    var ConSid = '';
    for (var i=0;i<a.length;i++) {
        if(a[i]==':') {
            for (var j=i+1;j<a.length;j++) {
                if(a[j] != '.') {
                    ConSid += a[j];
                    //continue;
                }
                else {return ConSid;};
            }
        }
    }
}

function setGetSig(arr) {
    arr.sort();
    return arr[0] + '_' + arr[1];
}

async function loadUser(session) {
    try {
        console.log('retrieving user: ', session.user);
        if (!session.user) {
            console.log('Session %s is anonymous', session.id);
            return {err:null,user:null};
        }
        let user = await User.findByPk(session.user);
        //console.log('user found by Id result: ',user);
        if (!user) return {err:null,user:null};
        return {err:null,user:user};
    }catch(err){
        return {err:err,user:null};
    }
}

function findClientsSocket(roomId, namespace, io) {
    var res = []
        // the default namespace is "/"
        , ns = io.of(namespace ||"/");

    if (ns) {
        for (var id in ns.connected) {
            if(roomId) {
                var index = ns.connected[id].rooms.indexOf(roomId);
                if(index !== -1) {
                    res.push(ns.connected[id]);
                }
            } else {
                res.push(ns.connected[id]);
            }
        }
    }
    return res;
}

async function asyncIncludes(arr, chkItm) {
    for (itm of arr) {
        if(itm === chkItm) return true;
    }
    return false;
}

async function aggregateUserData(username) {
    try {
        let data = await User.findOne({
            where: {username:username},
            include: [
                {model: Room,as:'rooms'},
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ],
        });

        let userData = await data.reformatData();
        console.log('test agrReFormatData: ', userData);
        let contacts = userData.contacts || [];
        let blockedContacts = userData.blockedContacts || [];
        let rooms = userData.rooms|| [];


        let wL = contacts.map(async (name,i) =>{
            let status = !!globalChatUsers[name];
            let data = await User.findOne({
                where:{username:name},
                include: [
                    {model: User,as:'contacts'},
                    {model: User,as:'blockedContacts'},
                ],
            });
            let nameUserDB =  await data.reformatData();
            let banned = nameUserDB.blockedContacts.includes(username);
            let authorized =  !(!nameUserDB.contacts.includes(username) && !nameUserDB.blockedContacts.includes(username));
            let {err,mes} = await Message.messageHandler({sig:setGetSig([username,name])});

            let col = mes.filter(itm => itm.author !== username && itm.recipients[0].status === false).length;
            return contacts[i] = {name:name,  msgCounter :col, allMesCounter: mes.length, typing:false, onLine:status, banned:banned, authorized:authorized, created_at:nameUserDB.created, userId:nameUserDB._id}
        });
        let bL = blockedContacts.map(async (name,i) =>{
            let status = !!globalChatUsers[name];
            let data = await User.findOne({
                where:{username:name},
                include: [
                    {model: User,as:'contacts'},
                    {model: User,as:'blockedContacts'},
                ],
            });
            let nameUserDB = await data.reformatData();
            let banned = nameUserDB.blockedContacts.includes(username);
            let authorized =  !(!nameUserDB.contacts.includes(username) && !nameUserDB.blockedContacts.includes(username));
            let {err,mes} = await Message.messageHandler({sig:setGetSig([username,name])});
            let col = mes.filter(itm => itm.author !== username && itm.recipients[0].status === false).length;
            return blockedContacts[i] = {name:name, msgCounter :col, allMesCounter: mes.length,typing:false, onLine:status, banned:banned, authorized:authorized, created_at:nameUserDB.created, userId:nameUserDB._id}
        });
        let rL = rooms.map(async (name,i) =>{
            let data = await Room.findOne({
                where:{name:name},
                include: [
                    {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                    {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                ],
            });
            let consoleData = data.toJSON();
            console.log('aggDataRooms: ',consoleData.members[0].rooms);
            let room = await data.reformatData();

            let {err,mes} = await Message.messageHandler({sig:name});
            let col = 0;
            for(let itm of mes) {
                if (itm.author === username) continue;
                if(itm.recipients.find(rcpnts => rcpnts.username === username).status === false) col +=1;
            }
            return rooms[i] = {name:name, msgCounter:col, allMesCounter:mes.length, members:room.members, blockedMembers:room.blockedMembers, created_at:room.created_at, groupId:room._id}
        });
        userData.contacts = await Promise.all(wL);
        userData.blockedContacts = await Promise.all(bL);
        userData.rooms = await Promise.all(rL);
        //console.log("aggregateUserData: ",username,": ",userData);
        return userData;
    } catch (err) {
        console.log("aggregateUserData err: ",err)
    }
}

let getStoreSes = (sig) => {
    return new Promise(
        (resolve, reject) => {
            sessionStore.get(sig,function(err,session){
                if(err) reject({err:err,session:null});
                resolve({err:null,session:session})
            })
        }
    )
};


module.exports = function (server) {

    var io = require('socket.io').listen(server);



    io.set('authorization', async function (handshake,callback) {
        try {
            handshake.cookies = cookie.parse(handshake.headers.cookie || '');
            let sidCookie = handshake.cookies[config.get('session:key')];
            //console.log('sidCookie: ',sidCookie);
            if (!sidCookie) return callback(JSON.stringify(new HttpError(401, 'No Cookie')));
            let sid = getConSid(sidCookie);
            //console.log('authorizationSessionId: ',sid);
            let {error,session} = await getStoreSes(sid);
            //console.log('authorizationSessionId session: ',session);
            if(error) return callback(new DevError(500, 'Session error: ' + error));
            //console.log('authorization session: ',session,'error: ',error);
            if (!session) return callback(JSON.stringify(new HttpError(401, 'No session')));
            handshake.session = session;
            let {errLU,user} = await loadUser(session);
            if(errLU) return callback(JSON.stringify(new DevError(500, 'DB error: ' + error)));
            //console.log('loadUser userId: ',user);
            if(!user) return callback(JSON.stringify(new  HttpError(401, 'Anonymous session may not connect')));
            if(globalChatUsers[user.username]) {
                //console.log("multiChatConnection");
                delete globalChatUsers[user.username];
                return callback(JSON.stringify(new HttpError(423, 'Locked! You tried to open Chat Page in another tab.')));
            }
            handshake.user = user;
            return callback(null, true);
        }catch (error) {
            console.log('authorization error: ',error);
            return new DevError(500, 'Socket Authorization error: ',error)
        }
    });

    common.on('session:reload', async function (sid) {
        try{
            console.log('session:reloadSid: ',sid);
            let clients = findClientsSocket(null,null,io);
            //console.log('clients: ',clients);
            for (const client of clients) {
                let sidCookie = cookie.parse(client.handshake.headers.cookie);
                //console.log('sidCookie: ',sidCookie);
                let sessionId = getConSid(sidCookie.sid);
                //console.log('session:reloadSessionId: ',sessionId);
                if (sessionId !== sid) return;
                let {err,session} = await getStoreSes(sid);
                if (err) {
                    //console.log('sessionStore.load err: ',err);
                    return {err:JSON.stringify(new HttpError(423, 'Socket Session:reload err: ',err)),user:null};
                }
                if (!session) {
                    //console.log('sessionStore.load no session find');
                    client.emit('logout');
                    client.disconnect();
                    return;
                }
                client.handshake.session = session;
            }
        }catch(err){
            console.log('session:reload err: ',err);
            return {err:JSON.stringify(new HttpError(423, 'Socket Session:reload err: ',err)),user:null};
        }
    });



    io.sockets.on('connection', async function (socket) {
        //Global Chat Events
        let username = socket.request.user.username;//req username
        let reqSocketId = socket.id;//req user socket id
        const userDB = await aggregateUserData(username);
        //console.log('connection userDB: ',userDB);
        //update global chat users obj
        //obj to store  onLine users sockedId
        globalChatUsers[username] = {
            sockedId:reqSocketId,
            contacts:userDB.contacts.map(itm => itm.name) || [], //use only for username otherwise the data may not be updated.
            blockedContacts:userDB.blockedContacts.map(itm => itm.name) || [], //use only for username otherwise the data may not be updated.
        };
        console.log('connection globalChatUsers: ',globalChatUsers);
        //update UserData
        socket.emit('updateUserData',userDB);
        //Update if username was changed
        common.on('changeUserName', async function (newUserName) {
            try{
                console.log('changeUserName: ',newUserName);
                let user = await User.findOne(
                    {
                        where:{username:newUserName},
                        include:[
                            {model: User,as:'contacts'},
                            {model: User,as:'blockedContacts'},
                        ]
                    });
                let refUser = await user.reformatData();
                let conts = [...refUser.contacts,...refUser.blockedContacts];
                console.log('changeUserName conts: ',conts);
                for(let itm of conts) {
                    if(globalChatUsers[itm]) socket.broadcast.to(globalChatUsers[itm].sockedId).emit('updateUserData', await aggregateUserData(itm));
                }
            }catch(err){
                console.log('changeUserName err: ',err);
                return {err:JSON.stringify(new HttpError(423, 'ChangeUserName err: ',err)),user:null};
            }
        });
        //move to black list
        socket.on('banUser', async function (data,cb) {
            try {
                console.log("banUser name:" ,data.name);
                let {err:errRG, user:userRG} = await User.userMFCTBC(username,data.name);//move to blockedContacts
                if(errRG) return cb("Move user to black list filed. DB err: " + userRG.err,null);
                //update globalChatUsers[username] data
                globalChatUsers[username].contacts = userRG.contacts;
                globalChatUsers[username].blockedContacts = userRG.blockedContacts;
                let {err,mes} = await Message.messageHandler({sig:setGetSig([username,data.name]),members:[username,data.name],message:{ author: username, text: "I added you to my black list.", status: false, date: data.date}});
                if(globalChatUsers[data.name]) {
                    socket.broadcast.to(globalChatUsers[data.name].sockedId).emit('updateUserData',await aggregateUserData(data.name));
                    socket.broadcast.to(globalChatUsers[data.name].sockedId).emit('message',mes);
                }
                cb(null,await aggregateUserData(username),mes);
            } catch (err) {
                console.log("banUser err: ",err);
                cb(err,null,null)
            }
        });
        //move to white list
        socket.on('unBanUser', async function (data,cb) {
            try {
                console.log("unBanUser name:" ,data.name);
                let {err:errRG, user:userRG} = await User.userMFBCTC(username,data.name);//move to Contacts
                if(errRG) return cb("Move user to black list filed. DB err: " + userRG.err,null);
                //update globalChatUsers[username] data
                globalChatUsers[username].contacts = userRG.contacts;
                globalChatUsers[username].blockedContacts = userRG.blockedContacts;
                let {err,mes} = await Message.messageHandler({sig:setGetSig([username,data.name]),members:[username,data.name],message:{ author: username, text: "I added you to my contact list.", status: false, date: data.date}});
                if(globalChatUsers[data.name]) {
                    socket.broadcast.to(globalChatUsers[data.name].sockedId).emit('updateUserData',await aggregateUserData(data.name));//update user data
                    socket.broadcast.to(globalChatUsers[data.name].sockedId).emit('message',mes);
                }
                cb(null,await aggregateUserData(username),mes);
            } catch (err) {
                console.log("unBanUser err: ",err);
                cb(err,null,null)
            }
        });
        //remove completely
        socket.on('deleteUser', async function (data,cb) {
            try {
                console.log("deleteUser name:" ,data);
                let {err:errRG, user:userRG} = await User.userRFAL(username,data.name);//remove from contacts & blockedContact
                if(errRG) return cb("Delete user filed. DB err: " + userRG.err,null);
                //update globalChatUsers[username] data
                globalChatUsers[username].contacts = userRG.contacts;
                globalChatUsers[username].blockedContacts = userRG.blockedContacts;
                //
                let {err,mes} = await Message.messageHandler({sig:setGetSig([username,data.name]),members:[username,data.name],message:{ author: username, text: "I deleted you from my contact list.", status: false, date: data.date}});
                //let idx = mes._id;
                if(globalChatUsers[data.name]) {
                    socket.broadcast.to(globalChatUsers[data.name].sockedId).emit('updateUserData',await aggregateUserData(data.name));//update user data
                    socket.broadcast.to(globalChatUsers[data.name].sockedId).emit('message', mes);
                    cb(null,await aggregateUserData(username));
                } else cb(null,await aggregateUserData(username));
            } catch (err) {
                console.log("deleteUser err: ",err);
                cb(err,null)
            }
        });
        //check user online
        socket.on('checkOnLine', function (name,cb) {
            cb(!!globalChatUsers[name]);
        });
        //req show me online
        socket.on('sayOnLine', function () {
            console.log('sayOnLine');
            if(!globalChatUsers[username]) return;
            let contacts = globalChatUsers[username].contacts;
            let blockedContacts = globalChatUsers[username].blockedContacts;
            console.log("sayOnLine, username: ",username,", contacts: ",contacts,", blockedContacts: ",blockedContacts);
            //res for my contacts what Iam onLine
            contacts.concat(blockedContacts).forEach((name)=>{
                if(globalChatUsers[name]) socket.broadcast.to(globalChatUsers[name].sockedId).emit('onLine', username);
            });
        });
        //req show me offLine
        socket.on('sayOffLine', function () {
            console.log('sayOffLine');
            let contacts = globalChatUsers[username].contacts;
            let blockedContacts = globalChatUsers[username].blockedContacts;
            console.log("sayOffLine, username: ",username,", contacts: ",contacts,", blockedContacts: ",blockedContacts);
            //res for my contacts what Iam onLine
            contacts.concat(blockedContacts).forEach((name)=>{
                if(globalChatUsers[name]) socket.broadcast.to(globalChatUsers[name].sockedId).emit('offLine', username);
            });
        });
        //req to add me to contact list
        socket.on('addMe', async function (data,cb) {
            try {
                console.log('addMe: ',data);
                let sig = setGetSig([username,data.name]);
                console.log('addMe sig: ',sig);
                let lastMes = await Message.findAll({
                    limit:1,
                    where:{sig:sig},
                    order: [[ 'createdAt', 'DESC' ],],
                });
                console.log("lastMes: ",lastMes);
                if(lastMes.length === 0 || lastMes[0].text !== "Please add me to you contact list.") {//Save message in DB if last !== "Please add me to you contact list." || len == 0
                    let {err:errRG, user:userRG} = await User.userATC(username,data.name);//add to contacts
                    let {err:errRD, user:userRD} = await User.userATBC(data.name,username);//add to blocked contacts
                    console.log("userRG: ",userRG);
                    if(errRG) return cb("Request rejected. DB err: "+errRG,null);
                    if(errRD) return cb("Request rejected. DB err: "+errRD,null);

                    globalChatUsers[username].contacts = userRG.contacts;
                    globalChatUsers[username].blockedContacts = userRG.blockedContacts;
                    let {err,mes} = await Message.messageHandler({sig:sig,members:[username,data.name],message:{author: username, text: "Please add me to you contact list.", status: false, date: data.date}});
                    if(globalChatUsers[data.name]) {//Send message "Add me to you contact list" if user online
                        socket.broadcast.to(globalChatUsers[data.name].sockedId).emit('updateUserData',await aggregateUserData(data.name));
                        socket.broadcast.to(globalChatUsers[data.name].sockedId).emit('message',mes);
                    }
                    cb(null,await aggregateUserData(username),mes);
                }else cb("Request rejected. You always send request. Await then user response you.",null);
            } catch (err) {
                console.log("addMe err: ",err);
                cb(err,null,null)
            }
        });
        //Find contacts

        socket.on('findContacts', async function (nameString,cb) {
            try {
                //console.log("findContacts nameString:", nameString);
                //let users = await User.find( { "username": { "$regex": nameString, "$options": "i" } } );
                let users = await User.findAll({where: {username:{[Op.iLike]: '%' + nameString + '%'}}});
                console.log("findContacts users:",users);
                let usersArr = users.map(itm=>itm.username).filter(name => name !== username);
                return  cb(null,usersArr);
            } catch (err) {
                console.log("findContacts err:",err);
                return cb(err,null)
            }
        });
        //Check contact
        socket.on('checkContact', async function (data,cb) {
            console.log('checkContact: ',data);
            let user = await User.findOne({raw: true,where:{username:data}}) || await User.findOne({raw: true,where:{_id:data}});
            if(user) {
                return cb(user.username);
            } else return cb(null)
        });
        //chat users history cb
        socket.on('getUserLog', async function (reqUsername,reqMesCountCb,reqMesId,cb) {
            try {
                console.log("getUserLog reqUsername: ", reqUsername);
                let {err,mes} = await Message.messageHandler({sig:setGetSig([username,reqUsername])},reqMesCountCb);
                if(err) return cb(err,null);
                return cb(null,mes);
            } catch (err) {
                console.log("getUserLog err: ",err);
                return cb(err,null)
            }
        });
        //set chat mes status
        socket.on('setMesStatus',async function (idx,reqUsername,cb) {
            try {
                console.log("setMesStatus: indexArr: ",idx," ,reqUsername: ",reqUsername);
                let user = await User.findOne({where:{username:username}});
                console.log("setMesStatus: user._id: ",user._id);
                await MessageData.update(
                    {status: true},
                    {where:{
                            messageId:idx,
                            userId:user._id
                        }
                    });
                if(globalChatUsers[reqUsername]) socket.broadcast.to(globalChatUsers[reqUsername].sockedId).emit('updateMsgStatus',username,idx,true);
                cb(null);
            } catch (err) {
                console.log("setMesStatus err: ",err);
                cb(err);
            }
        });
        //chat message typing
        socket.on('typing', function (name) {
            if(!globalChatUsers[name]) return;
            let sid = globalChatUsers[name].sockedId;
            socket.broadcast.to(sid).emit('typing', username);
        });
        //chat message receiver
        socket.on('message', async function (text,resToUserName,dateNow,cb) {
            try {
                console.log('message');
                // if(text.split(' ')[0] === 'console:'){
                //     let consoleArr = text.split(' ');
                //     console.log('message console command: ', consoleArr[1],',', 'message console data: ', consoleArr[2]);
                //     let mes;
                //     switch (consoleArr[1]){
                //         case "deleteMsg":
                //             console.log("message console deleteMsg DATA: ", consoleArr[2].split(','));
                //             let ids = consoleArr[2].split(',');
                //             //delete all messages with ids and check members array
                //             await Message.deleteMany({$and:[{_id:{$in:ids}},{members:{$all:[username,resToUserName]}}]});
                //             //delete user's messages in messageStore
                //             socket.emit('updateMessageStore',resToUserName,ids);
                //             if(globalChatUsers[resToUserName]) socket.broadcast.to(globalChatUsers[resToUserName].sockedId).emit('updateMessageStore',username,ids);
                //             break;
                //         case "getAllUsersOnline":
                //             console.log("message console getAllUsersOnline: ");
                //             let usersOnLine = Object.keys(globalChatUsers).join();
                //             mes = { members:[username,resToUserName],
                //                 statusCheckArr: [],
                //                 _id: 'noId',
                //                 uniqSig: setGetSig([username,resToUserName]),
                //                 text: usersOnLine,
                //                 user: username,
                //                 status: true,
                //                 date: Date.now()};
                //             return cb(null,mes);
                //             break;
                //         case "getMyId":
                //             console.log("message console getMyId: ");
                //             mes = { members:[username,resToUserName],
                //                 statusCheckArr: [],
                //                 _id: 'noId',
                //                 uniqSig: setGetSig([username,resToUserName]),
                //                 text: userDB._id,
                //                 user: username,
                //                 status: true,
                //                 date: Date.now()};
                //             return cb(null,mes);
                //             break;
                //         default:
                //             console.log("message console : Sorry, we are out of " + consoleArr[1] + ".");
                //     }
                // }
                if (text.length === 0 || !resToUserName) return;
                if (text.length >= 500) return cb("To long message!",null);
                let resUser = await User.findOne({where:{username:resToUserName},include:[{model:User,as:'contacts'}]});
                if(globalChatUsers[username].blockedContacts.includes(resToUserName)) return cb("You can not write to baned users!",null);
                if(!resUser.contacts.map(itm => itm.username).includes(username)) return cb("User "+resToUserName+" do not add you in his white list!",null);
                let {err,mes} = await Message.messageHandler({sig:setGetSig([username,resToUserName]),members:[username,resToUserName],message:{ author: username, text: text, status: false, date: dateNow}});
                if(err) return cb("Add message to DB err: " + err,null);
                //console.log('message mes:',mes);
                if(!globalChatUsers[resToUserName]) return cb(null,mes);
                let sid = globalChatUsers[resToUserName].sockedId;
                socket.broadcast.to(sid).emit('message', mes);
                cb(null,mes);
            } catch (err) {
                console.log("message err: ",err);
                cb(err,null);
            }
        });
        //chat message forward
        socket.on('messageForward', async function (ids,toUserName,from, cb) {
            try {
                console.log('messageForward ids: ',ids,', toUserName: ',toUserName,', from: ',from);
                if(toUserName === from) return cb("You can not forward to same user!",null);
                let mesArray = await Message.findAll({where:{_id:{[Op.in]:ids}}});//find all mes
                let toUser = await User.findOne(
                    {where:{username:toUserName},
                        include:[
                            {model: User,as:'contacts'},
                            {model: User,as:'blockedContacts'},
                        ]});
                let fromUser = await User.findOne(
                    {where:{username:from},
                        include:[
                            {model: User,as:'contacts'},
                            {model: User,as:'blockedContacts'},
                        ]});
                if(fromUser)  {
                    let toUserContacts = await toUser.reformatData();
                    if(!toUserContacts.contacts.includes(username)) return cb("User "+toUserName+" do not add you in his white list!",null);
                }
                if(globalChatUsers[username].blockedContacts.includes(toUserName)) return cb("You can not write to baned users!",null);
                let fromRoom;
                let roomMembers;
                if(!fromUser) {
                    fromRoom = await Room.findOne(
                        {where:{name:from},
                            include:[
                                {model: User,as:'members'},
                                {model: User,as:'blockedMembers'},
                            ]});

                    roomMembers = fromRoom.members
                }
                let forwardedMesArr =  [];
                for (const item of mesArray) {
                    let mes = await Message.create({
                        text: item.text,
                        sig:setGetSig([username,toUserName]),
                        date:item.date,
                        author:item.author,
                        forwardFrom:fromUser ? fromUser.username : fromRoom.name
                    });
                    forwardedMesArr.push(mes._id);
                    if(fromUser) await mes.addRecipient(toUser);
                    if(fromRoom) await mes.addRecipients(roomMembers);
                }
                mesArray = await Message.findAll({
                    where:{_id:{[Op.in]:forwardedMesArr}},
                    include:{
                        model:User,
                        as:'recipients',
                        attributes: ['username'],
                        through: {attributes: ['status']}
                    }
                });
                if(!globalChatUsers[toUserName]) return cb(null,mesArray);
                let sid = globalChatUsers[toUserName].sockedId;
                socket.broadcast.to(sid).emit('messageForward', mesArray,username);
                cb(null,mesArray);
            } catch (err) {
                console.log("messageForward err: ",err);
                cb(err,null);
            }
        });
        //room events
        //create new room
        socket.on('createRoom', async function  (roomName,dateNow,cb) {
            try {
                console.log('createRoom: ',roomName);
                let {err,room,user} = await Room.createRoom(roomName,username);
                let roomData = await room.reformatData();
                if(err) {
                    return cb(err,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:roomData.members,message:{ author: username, text: username+" created a new group "+roomName+".", status: false, date: dateNow}});
                    return cb(null,await aggregateUserData(username))
                }
            } catch (err) {
                console.log("createRoom err: ",err);
                cb(err,null)
            }
        });
        //invite users to room
        socket.on('inviteUserToRoom', async function  (roomName,invitedUser,dateNow,cb) {
            try {
                console.log('inviteUserToRoom: ',roomName);
                let {err,room,user} = await Room.inviteUserToRoom(roomName,invitedUser);
                room = await room.reformatData();
                let roomMembers = room.members.map(itm => itm.username);
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:roomMembers, message:{ author: username, text: username+" added new user "+invitedUser+".", status: false, date: dateNow}});
                    if(globalChatUsers[invitedUser]) socket.broadcast.to(globalChatUsers[invitedUser].sockedId).emit('updateUserData',await aggregateUserData(invitedUser));
                    for (let itm of roomMembers) {
                        if(globalChatUsers[itm.username]) {
                            socket.broadcast.to(globalChatUsers[itm.username].sockedId).emit('updateUserData',await aggregateUserData(itm.name));
                            socket.broadcast.to(globalChatUsers[itm.username].sockedId).emit('messageRoom',mes);
                        }
                    }
                    cb(null,await aggregateUserData(username),mes)
                }
            } catch (err) {
                console.log("inviteUserToRoom err: ",err);
                cb(err,null,null)
            }
        });
        //leave room
        socket.on('leaveRoom', async function  (roomName,dateNow,cb) {
            try {
                console.log("leaveRoom: ",roomName);
                let {err,room,user} = await Room.leaveRoom(roomName,username);
                if(!room) return cb(null,await aggregateUserData(username));
                if(err) {
                    console.log('leaveRoom err: ',err);
                    return cb(err,null)
                }
                else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:getRoomMembers(room),message:{ author: username, text: username+" left the group.", status: false, date: dateNow}});
                    for (let itm of room.members) {
                        if(globalChatUsers[itm.name]) {
                            socket.broadcast.to(globalChatUsers[itm.name].sockedId).emit('updateUserData',await aggregateUserData(itm.name));
                            socket.broadcast.to(globalChatUsers[itm.name].sockedId).emit('messageRoom',mes);
                        }
                    }
                    cb(null,await aggregateUserData(username))
                }
            } catch (err) {
                console.log("leaveRoom err: ",err);
                cb(err,null)
            }
        });
        //get room log
        socket.on('getRoomLog', async function  (roomName,reqMesCountCb,reqMesId,cb) {
            try {
                console.log("getRoomLog: ",roomName);
                let room = await Room.findOne({
                    where:{name:roomName},
                    include: [
                        {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                        {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                    ],
                });
                room = await room.reformatData();
                console.log("getRoomLog room: ",room);
                if(!room) return cb("Error Group do not exist!",null);
                if(room.blockedMembers.some(itm => itm.username === username)) return cb("You have been included in the block list. Message history is no longer available to you.",null);
                if(!room.members.some(itm => itm.username === username)) return cb("You are not a member of the group.",null);
                let {err,mes} = await Message.messageHandler({sig:roomName},reqMesCountCb);
                if(err) return cb(err,null);
                return cb(null,mes);
            } catch (err) {
                console.log("getRoomLog err: ",err);
                cb(err,null)
            }
        });
        //room message handler
        socket.on('messageRoom', async function  (text,roomName,dateNow,cb) {
            try {
                console.log('messageRoom text: ',text, 'roomName: ',roomName, 'dateNow: ',dateNow);
                if (text.length === 0) return;
                if (text.length >= 500) return cb("To long message.",null);
                let room = await Room.findOne({
                    where:{name:roomName},
                    include: [
                        {model: User,as:'members'},
                        {model: User,as:'blockedMembers'},
                    ],
                });
                room = await room.reformatData();
                console.log('messageRoom room: ',room);
                if(!room.members.includes(username)) return cb("You are not a member of the group.",null);
                if(room.blockedMembers.includes(username)) return cb("You have been included in the block list. Send messages to you is no longer available.",null);
                let {err,mes} = await Message.messageHandler({sig:roomName,members:room.members, message:{ author: username, text: text, status: false, date: dateNow}});
                for(let name of room.members) {
                    if(globalChatUsers[name] && name !== username) socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageRoom',mes);
                }
                cb(null,mes);
            } catch (err) {
                console.log("messageRoom err: ",err);
                cb(err,null);
            }
        });
        //block user in room
        //UnDoing FE
        socket.on('blockRoomUser', async function  (roomName,bannedUser,dateNow,cb) {
            try {
                console.log('blockRoomUser roomName: ',roomName," ,bannedUser: ",bannedUser);
                let {err,room} = await Room.blockUserInRoom(roomName,username,bannedUser);
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:getRoomMembers(room),message:{user:username,text:"The group administrator "+username+" has added user "+bannedUser+" to the block list.",status: false,date: dateNow}});
                    for (let itm of room.members){
                        if(globalChatUsers[itm.name]) {
                            socket.broadcast.to(globalChatUsers[itm.name].sockedId).emit('updateUserData',await aggregateUserData(itm.name));
                            socket.broadcast.to(globalChatUsers[itm.name].sockedId).emit('messageRoom',mes);
                        }
                    }
                    cb(null,await aggregateUserData(username),mes)
                }
            } catch (err) {
                console.log("blockRoomUser err: ",err);
                cb(err,null,null)
            }
        });
        //unblock user in room
        socket.on('unBlockRoomUser', async function  (roomName,unbannedUser,dateNow,cb) {
            try {
                console.log('unBlockRoomUser roomName: ',roomName," ,bannedUser: ",unbannedUser);
                let {err,room} = await Room.unblockUserInRoom(roomName,username,unbannedUser);
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:getRoomMembers(room),message:{ author: username, text: "The group administrator "+username+" has removed user "+unbannedUser+" from the block list.", status: false, date: dateNow}});
                    for (let itm of room.members){
                        if(globalChatUsers[itm.name]) {
                            socket.broadcast.to(globalChatUsers[itm.name].sockedId).emit('updateUserData',await aggregateUserData(itm.name));
                            socket.broadcast.to(globalChatUsers[itm.name].sockedId).emit('messageRoom',mes);
                        }
                    }
                    cb(null,await aggregateUserData(username),mes)
                }
            } catch (err) {
                console.log("unBlockRoomUser err: ",err);
                cb(err,null,null)
            }
        });
        //set room admin
        socket.on('setRoomAdmin', async function  (roomName,newAdminName,dateNow,cb) {
            try {
                console.log('setRoomAdmin roomName: ',roomName," ,userName: ",newAdminName);
                let {err,room} = await Room.setAdminInRoom(roomName,username,newAdminName);
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:getRoomMembers(room),message:{ author: username, text: username+" has appointed "+newAdminName+" a new administrator.", status: false, date: dateNow}});
                    for (let itm of room.members){
                        if(globalChatUsers[itm.name]) {
                            socket.broadcast.to(globalChatUsers[itm.name].sockedId).emit('updateUserData',await aggregateUserData(itm.name));
                            socket.broadcast.to(globalChatUsers[itm.name].sockedId).emit('messageRoom',mes);
                        }
                    }
                    cb(null,await aggregateUserData(username),mes)
                }
            } catch (err) {
                console.log("setRoomAdmin err: ",err);
                cb(err,null,null)
            }
        });
        //enable/disable notification
        socket.on('changeNtfStatus', async function  (roomName,cb) {
            try {
                console.log('changeNtfStatus roomName: ',roomName);
                let room = await Room.findOne({where:{name:roomName}});
                if(!room.members.some(itm => itm.name === username) || room.blockedContacts.some(itm => itm.name === username)) {
                    return cb("You are not a member of this group or you are on the block list.",null);
                }
                let idx = room.members.find(itm => itm.name === username)._id;
                let statusNot = room.members.find(itm => itm.name === username).enable;
                await Room.findOneAndUpdate({name:roomName ,"members._id": idx},{"members.$.enable" : !statusNot});
                //console.log("changeNtfStatus room: ",room);
                cb(null,await aggregateUserData(username))
            } catch (err) {
                console.log("setRoomAdmin err: ",err);
                cb(err,null)
            }
        });
        //find message
        socket.on('findMessage', async function  (sig,textSearch,cb) {
            try {
                console.log('findMessage, init sig: ',sig);
                if( Array.isArray(sig)) {//2 members correspondence
                    //check: Is username member of correspondence?
                    if(!sig.includes(username)) return cb("Canceled. Attempted unauthorized access to data.",null);
                    sig = setGetSig(sig);
                }
                if( typeof sig === 'string') {//room correspondence
                    //check: Is username member of room?
                    let {members} = await Room.findOne({where:{name:sig}});
                    //console.log("members: ",members);
                    if(!members.some((itm) => itm.name === username)) return cb("Canceled. Attempted unauthorized access to data.",null);
                    console.log('findMessage, sig: ',sig," ,textSearch: ",textSearch);
                }
                let mesQuery = await Message.find(
                    { uniqSig: sig, $text: { $search: textSearch } },
                    { score: { $meta: "textScore" } }
                ).sort( { date: 1, score: { $meta: "textScore" } } );
                cb(null,mesQuery)
            } catch (err) {
                console.log("findMessage err: ",err);
                cb(err,null)
            }
        });
        //delete messages, only for users conversation
        socket.on('deleteMessages', async function  (reqUsername,ids,cb) {
            try {
                console.log('deleteMessages, ids: ',ids,' ,reqUsername: ',reqUsername);
                //delete all messages with ids and check members array
                await Message.deleteMany({$and:[{_id:{$in:ids}},{members:{$all:[username,reqUsername]}}]});
                //delete user's messages in messageStore
                if(globalChatUsers[reqUsername]) socket.broadcast.to(globalChatUsers[reqUsername].sockedId).emit('updateMessageStore',username,ids);
                cb(null)
            } catch (err) {
                console.log("deleteMessage err: ",err);
                cb(err)
            }
        });

        //
        // when the user disconnects perform this
        socket.on('disconnect', async function () {
            try {
                let contacts = globalChatUsers[username].contacts;
                let blockedContacts = globalChatUsers[username].blockedContacts;
                console.log("disconnect, username: ",username,", contacts: ",contacts,", blockedContacts: ",blockedContacts);
                //res for my contacts what Iam offLine
                contacts.concat(blockedContacts).forEach((name)=>{
                    if(globalChatUsers[name]) socket.broadcast.to(globalChatUsers[name].sockedId).emit('offLine', username);
                });
                //del user from globalUsers
                delete globalChatUsers[username];
            } catch (err) {
                console.log("disconnect err: ",err);
            }
        });
    });
    return io;
};


