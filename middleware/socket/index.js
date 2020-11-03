var config = require('./../../config');
var cookie = require('cookie');
var sessionStore = require('../db/sessionStore');
var HttpError = require('./../error/index').HttpError;
var DevError = require('./../error/index').DevError;
var User = require('../db/models/index').User;
var Message = require('../db/models/index').Message;
var Room = require('../db/models/index').Room;
var MessageData = require('../db/models/index').MessageData;
var UserRoom = require('../db/models/index').UserRoom;
var globalChatUsers = {};
var common = require('../common').commonEmitter;
const { Op } = require("sequelize");



async function reformatDataArray(forwardedMesArr) {

    let promisesMes = forwardedMesArr.map(itm => itm.reformatData());
    forwardedMesArr = await Promise.all(promisesMes);
    forwardedMesArr.sort((a,b) => a.createdAt - b.createdAt);
    console.log("forwardedMesArr: ",forwardedMesArr);
    return forwardedMesArr
}

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
        //console.log('test agrReFormatData: ', userData);
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
            return contacts[i] = {name:name,  msgCounter :col, allMesCounter: mes.length, typing:false, onLine:status, banned:banned, authorized:authorized, created_at:nameUserDB.createdAt, userId:nameUserDB._id}
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
            return blockedContacts[i] = {name:name, msgCounter :col, allMesCounter: mes.length,typing:false, onLine:status, banned:banned, authorized:authorized, created_at:nameUserDB.createdAt, userId:nameUserDB._id}
        });
        let rL = rooms.map(async (name,i) =>{
            let data = await Room.findOne({
                where:{name:name},
                include: [
                    {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                    {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                ],
            });
            let room = await data.reformatData();
            let {err,mes} = await Message.messageHandler({sig:name});
            let mesFltr = mes.filter(itm => itm.author !== username && itm.recipients.some(itm => itm.username === username) && !itm.recipients.find(itm => itm.username === username).status);
            console.log('aggDataRooms mesFltr: ',mesFltr.length);
            return rooms[i] = {name:name, msgCounter:mesFltr.length, allMesCounter:mes.length, members:room.members, blockedMembers:room.blockedMembers, created_at:room.createdAt, groupId:room._id}
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
            _id:userDB._id,
            sockedId:reqSocketId,
            contacts:userDB.contacts.map(itm => itm.name) || [], //use only for username otherwise the data may not be updated.
            blockedContacts:userDB.blockedContacts.map(itm => itm.name) || [], //use only for username otherwise the data may not be updated.
            rooms:userDB.rooms.map(itm => itm.name) || [],
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
                if(errRG) return cb("Delete user filed. DB err: " + errRG,null);
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
            let user = await User.findOne({where:{username:data}}) || await User.findOne({where:{_id:data}});
            user = await user.reformatData();
            if(user) {
                return cb(user.username);
            } else return cb(null)
        });
        //chat users history cb
        socket.on('getUserLog', async function (reqUsername,reqMesCountCb,reqMesId,cb) {
            try {
                console.log("getUserLog reqUsername: ", reqUsername, " ,mesCol: ",reqMesCountCb," ,reqMesId: ",reqMesId);
                let {err,mes} = await Message.messageHandler({sig:setGetSig([username,reqUsername])},reqMesCountCb);
                if(err) return cb(err,null);
                if(reqMesId) {
                    mes = await Message.findAll({
                        where:{
                            sig:setGetSig([username,reqUsername]),
                            _id:{[Op.gte]:reqMesId}
                        },
                        order: [
                            [ 'createdAt', 'DESC' ],
                        ],
                        include:{
                            model:User,
                            as:'recipients',
                            attributes: ['username'],
                            through: {attributes: ['status']}
                        }
                    });
                    console.log("getUserLog mes: ",mes);
                    let promisesMes = mes.map(itm => itm.reformatData());
                    mes = await Promise.all(promisesMes);
                    mes.sort((a,b) => a.createdAt - b.createdAt);
                }

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
                let user = await User.findOne({where:{username:username}});//set user message status
                let reqUser = await User.findOne({where:{username:reqUsername}});//set room message status
                let room;
                if(!reqUser) {
                    room = await Room.findOne({where:{name:reqUsername},include:[{model:User,as:'members'},{model:User,as:'blockedMembers'}]});
                    room = await room.reformatData();
                    console.log("setMesStatus: room._id: ",room._id);
                }
                console.log("setMesStatus: user._id: ",user._id);
                await MessageData.update(
                    {status: true},
                    {where:{
                            messageId:idx,
                            userId:user._id
                        }
                    });
                if(reqUser) {
                    if(globalChatUsers[reqUsername]) socket.broadcast.to(globalChatUsers[reqUsername].sockedId).emit('updateMsgStatus',username,idx,null);
                } else {
                    for(let name of room.members) {
                        if(globalChatUsers[name] && name !== username) socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateMsgStatus',reqUsername,idx,username);
                    }
                }
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
                if(text.split(' ')[0] === 'console:'){
                    let consoleArr = text.split(' ');
                    console.log('message console command: ', consoleArr[1],',', 'message console data: ', consoleArr[2]);
                    let mes;
                    switch (consoleArr[1]){
                        case "shareLocation":
                            console.log("message console shareContact DATA: ", JSON.parse(consoleArr[2]));
                            let coor = JSON.parse(consoleArr[2]);
                            let resUser = await User.findOne({where:{username:resToUserName},include:[{model:User,as:'contacts'}]});
                            if(globalChatUsers[username].blockedContacts.includes(resToUserName)) return cb("You can not write to baned users!",null);
                            if(!resUser.contacts.map(itm => itm.username).includes(username)) return cb("User "+resToUserName+" do not add you in his white list!",null);
                            mes = await Message.create({text: "latitude: "+coor.latitude+", longitude: "+coor.longitude,sig:setGetSig([username,resToUserName]),date:dateNow,author:username,action:"shareLocation"},{
                                include:{model:User,as:"recipients"}
                            });//add action for message and to db field
                            await mes.addRecipient(await User.findOne({where:{username:resToUserName}}));
                            await mes.reload();
                            if(globalChatUsers[resToUserName]) socket.broadcast.to(globalChatUsers[resToUserName].sockedId).emit('message', mes);
                            return cb(null,mes);
                            break;
                        case "shareContact":
                            console.log("message console shareContact DATA: ", consoleArr[2]);
                            let sendUser = consoleArr[2];
                            let toUser = await User.findOne({where:{username:resToUserName},include:[
                                {model: User,as:'contacts'},
                                {model: User,as:'blockedContacts'}
                            ]});
                            if(!toUser) return cb( "User"+resToUserName+"not found!",null);
                            let sendContact = await User.findOne({where:{username:sendUser},include:[
                                {model: User,as:'contacts'},
                                {model: User,as:'blockedContacts'}
                            ]});
                            if(!sendContact) return cb( "User "+sendUser+" not found!",null);
                            toUser = await toUser.reformatData();
                            sendContact = await sendContact.reformatData();
                            if(!globalChatUsers[username].contacts.includes(sendUser) && !globalChatUsers[username].blockedContacts.includes(sendUser)) return cb("User "+sendUser+" is not in your contact lists!",null);
                            if(toUser.contacts.includes(sendUser) || toUser.blockedContacts.includes(sendUser)) return cb("User "+sendUser+" is always in his contact lists!",null);
                            if(sendContact.blockedContacts.includes(username) || sendContact.blockedContacts.includes(toUser.username)) return cb("User "+sendUser+" is always in his contact lists!",null);
                            if(sendContact.blockedContacts.includes(resToUserName)) return cb("User "+resToUserName+" included in his block list!",null);
                            if(sendContact.blockedContacts.includes(username)) return cb( "You are included in his block list!",null);
                            mes = await Message.create({text: sendContact.username,sig:setGetSig([username,resToUserName]),date:dateNow,author:username,action:"shareContact"},{
                                include:{model:User,as:"recipients"}
                            });//add action for message and to db field
                            await mes.addRecipient(await User.findOne({where:{username:resToUserName}}));
                            await mes.reload();
                            if(globalChatUsers[resToUserName]) socket.broadcast.to(globalChatUsers[resToUserName].sockedId).emit('message', mes);
                            return cb(null,mes);
                            break;
                        // case "deleteMsg":
                        //     console.log("message console deleteMsg DATA: ", consoleArr[2].split(','));
                        //     let ids = consoleArr[2].split(',');
                        //     //delete all messages with ids and check members array
                        //     await Message.deleteMany({$and:[{_id:{$in:ids}},{members:{$all:[username,resToUserName]}}]});
                        //     //delete user's messages in messageStore
                        //     socket.emit('updateMessageStore',resToUserName,ids);
                        //     if(globalChatUsers[resToUserName]) socket.broadcast.to(globalChatUsers[resToUserName].sockedId).emit('updateMessageStore',username,ids);
                        //     break;
                        // case "getAllUsersOnline":
                        //     console.log("message console getAllUsersOnline: ");
                        //     let usersOnLine = Object.keys(globalChatUsers).join();
                        //     mes = { members:[username,resToUserName],
                        //         statusCheckArr: [],
                        //         _id: 'noId',
                        //         sig: setGetSig([username,resToUserName]),
                        //         text: usersOnLine,
                        //         uthor: username,
                        //         status: true,
                        //         date: Date.now()};
                        //     return cb(null,mes);
                        //     break;
                        // case "getMyId":
                        //     console.log("message console getMyId: ");
                        //     mes = { members:[username,resToUserName],
                        //         statusCheckArr: [],
                        //         _id: 'noId',
                        //         sig: setGetSig([username,resToUserName]),
                        //         text: userDB._id,
                        //         author: username,
                        //         status: true,
                        //         date: Date.now()};
                        //     return cb(null,mes);
                        //     break;
                        default:
                            console.log("message console : Sorry, we are out of " + consoleArr[1] + ".");
                    }
                } else{
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
                }
            } catch (err) {
                console.log("message err: ",err);
                cb(err,null);
            }
        });
        //chat message forward 2
        //(messages id array, message receiver, message sender, message receiver User or Group, message sender User or Group)
        socket.on('messageForward', async function (ids,to,from,arrayFrowardTo,arrayFrowardFrom,cb) {

            try {
                console.log('messageForward ids: ',ids,', to: ',to,', from: ',from, ' ,arrayFrowardTo: ',arrayFrowardTo,' ,arrayFrowardFrom: ',arrayFrowardFrom);
                // let sender = await User.findOne({where:{username:username},include:[{model: User,as:'contacts'},{model: User,as:'blockedContacts'},{model:Room,as:'rooms'}]});
                // sender = await sender.reformatData();
                if(globalChatUsers[username].blockedContacts.includes(to)) return cb("You can not write to baned users!",null);
                if(!globalChatUsers[username].contacts.includes(to) && !globalChatUsers[username].rooms.includes(to)) return cb("User "+to+" is not in your contact lists!" , null);
                let mesArray = await Message.findAll({where:{_id:ids},include:{model:User,as:'recipients'}});//find all mes
                //Check if all messages belong to the user who makes the forward request
                let ckeckMes = await reformatDataArray(mesArray);
                ckeckMes = ckeckMes.map(itm => itm.author === username || itm.recipients.some(user => user.username === username));
                if(ckeckMes.length !== ids.length) return cb("The attempt of unauthorized access to the messages. Not all the requested messages belong to you.",null);
                //
                let fromUser,toUser,fromRoom,toRoom;
                let forwardedMesArr,idArr;
                switch (arrayFrowardFrom){
                    case "users":
                        //from users
                        switch (arrayFrowardTo){
                            case "users":
                                //to users
                                console.log('messageForward2 fUtU');
                                fromUser = await User.findOne({where:{username:from},include:[{model: User,as:'contacts'},{model: User,as:'blockedContacts'}]});
                                toUser = await User.findOne({where:{username:to},include:[{model: User,as:'contacts'}, {model: User,as:'blockedContacts'}]});
                                let toUserData = await toUser.reformatData();
                                if(toUserData.blockedContacts.includes(username)) return cb("User "+to+" do not add you in his white list!",null);
                                idArr = [];
                                for (const item of mesArray) {
                                    let mes = await Message.create({
                                        text: item.text,
                                        sig:setGetSig([username,to]),
                                        date:item.date,
                                        author:item.author,
                                        forwardFrom:fromUser.username
                                    });
                                    await mes.addRecipient(toUser);
                                    idArr.push(mes._id);
                                }
                                forwardedMesArr = await Message.findAll({where:{_id:idArr},include:{model:User,as:'recipients'}});
                                forwardedMesArr = await reformatDataArray(forwardedMesArr);

                                if(!globalChatUsers[to]) return cb(null,forwardedMesArr);
                                socket.broadcast.to(globalChatUsers[to].sockedId).emit('messageForward', forwardedMesArr,username);
                                cb(null,forwardedMesArr);
                                break;
                            case "rooms":
                                //to rooms
                                console.log('messageForward2 fUtR');
                                fromUser = await User.findOne({where:{username:from},include:[{model: User,as:'contacts'},{model: User,as:'blockedContacts'}]});
                                toRoom = await Room.findOne({where:{name:to},include:[{model: User,as:'members'}, {model: User,as:'blockedMembers'}]});
                                let toRoomData = await toRoom.reformatData();
                                if(toRoomData.blockedMembers.includes(username)) return cb("You do not member of group "+to+" or you blocked.",null);
                                idArr = [];
                                let roomMembers = await User.findAll({where:{username:toRoomData.members}});
                                for (const item of mesArray) {
                                    let mes = await Message.create({
                                        text: item.text,
                                        sig:to,
                                        date:item.date,
                                        author:item.author,
                                        forwardFrom:fromUser.username
                                    });
                                    await mes.addRecipients(roomMembers);
                                    idArr.push(mes._id);
                                }
                                forwardedMesArr = await Message.findAll({where:{_id:idArr},include:{model:User,as:'recipients'}});
                                forwardedMesArr = await reformatDataArray(forwardedMesArr);

                                for (const name of toRoomData.members) {
                                    if(globalChatUsers[name]) socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageForward', forwardedMesArr,null,to);
                                }
                                cb(null,forwardedMesArr);
                                break;
                            default:
                                return cb("Out of range, array handler error!" , null);
                        }
                        break;
                    case "rooms":
                        //from rooms
                        switch (arrayFrowardTo){
                            case "users":
                                //to users
                                console.log('messageForward2 fRtU');
                                fromRoom = await Room.findOne({where:{name:from},include:[{model: User,as:'members'}, {model: User,as:'blockedMembers'}]});
                                toUser = await User.findOne({where:{username:to},include:[{model: User,as:'contacts'}, {model: User,as:'blockedContacts'}]});
                                let toUserData = await toUser.reformatData();
                                if(toUserData.blockedContacts.includes(username)) return cb("User "+to+" do not add you in his white list!",null);
                                idArr = [];
                                for (const item of mesArray) {
                                    let mes = await Message.create({
                                        text: item.text,
                                        sig:setGetSig([username,to]),
                                        date:item.date,
                                        author:item.author,
                                        forwardFrom:fromRoom.name
                                    });
                                    await mes.addRecipient(toUser);
                                    idArr.push(mes._id);
                                }
                                forwardedMesArr = await Message.findAll({where:{_id:idArr},include:{model:User,as:'recipients'}});
                                forwardedMesArr = await reformatDataArray(forwardedMesArr);

                                if(!globalChatUsers[to]) return cb(null,forwardedMesArr);
                                socket.broadcast.to(globalChatUsers[to].sockedId).emit('messageForward', forwardedMesArr,username);
                                cb(null,forwardedMesArr);
                                break;
                            case "rooms":
                                //to rooms
                                console.log('messageForward2 fRtR');
                                fromRoom = await Room.findOne({where:{name:from},include:[{model: User,as:'members'}, {model: User,as:'blockedMembers'}]});
                                toRoom = await Room.findOne({where:{name:to},include:[{model: User,as:'members'}, {model: User,as:'blockedMembers'}]});
                                let toRoomData = await toRoom.reformatData();
                                if(toRoomData.blockedMembers.includes(username)) return cb("You do not member of group: "+to+",or you blocked.",null);
                                idArr =  [];
                                let roomMembers = await User.findAll({where:{username:toRoomData.members}});
                                for (const item of mesArray) {
                                    let mes = await Message.create({
                                        text: item.text,
                                        sig:to,
                                        date:item.date,
                                        author:item.author,
                                        forwardFrom:fromRoom.name
                                    });
                                    await mes.addRecipients(roomMembers);
                                    idArr.push(mes._id);
                                }
                                forwardedMesArr = await Message.findAll({where:{_id:idArr},include:{model:User,as:'recipients'}});
                                forwardedMesArr = await reformatDataArray(forwardedMesArr);

                                for (const name of toRoomData.members) {
                                    if(globalChatUsers[name]) socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageForward', forwardedMesArr,null,to);
                                }
                                cb(null,forwardedMesArr);
                                break;
                            default:
                                return cb("Out of range, array handler error!" , null);
                        }
                        break;
                    default:
                        return cb("Out of range, array handler error!" , null);
                }
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
                console.log('inviteUserToRoom room: ',room);
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:room.members, message:{ author: username, text: username+" added new user "+invitedUser+".", status: false, date: dateNow}});
                    //if(globalChatUsers[invitedUser]) socket.broadcast.to(globalChatUsers[invitedUser].sockedId).emit('updateUserData',await aggregateUserData(invitedUser));
                    for (let name of room.members) {
                        if(globalChatUsers[name] && name !== username) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageRoom',mes);
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
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:room.members,message:{ author: username, text: username+" left the group.", status: false, date: dateNow}});
                    for (let name of room.members) {
                        if(globalChatUsers[name]) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageRoom',mes);
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

                if(!reqMesId) {
                    var {err,mes} = await Message.messageHandler({sig:roomName},reqMesCountCb);
                    if(err) return cb(err,null);
                }else {
                    mes = await Message.findAll({
                        where:{
                            sig:roomName,
                            _id:{[Op.gte]:reqMesId}
                        },
                        order: [
                            [ 'createdAt', 'DESC' ],
                        ],
                        include:{
                            model:User,
                            as:'recipients',
                            attributes: ['username'],
                            through: {attributes: ['status']}
                        }
                    });
                    let promisesMes = mes.map(itm => itm.reformatData());
                    mes = await Promise.all(promisesMes);
                    mes.sort((a,b) => a.createdAt - b.createdAt);
                }
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
                        {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                        {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                    ],
                });
                let roomData = await room.reformatData();
                let enabledUsers = roomData.members.filter(itm => itm.enable).map(itm => itm.username);//do not send to users who have disabled notifications
                room.members = room.members.map(itm => itm.username);
                room.blockedMembers = room.blockedMembers.map(itm => itm.username);
                console.log('messageRoom room: ',room);

                if(!room.members.includes(username)) return cb("You are not a member of the group.",null);
                if(room.blockedMembers.includes(username)) return cb("You have been included in the block list. Send messages to you is no longer available.",null);
                let {err,mes} = await Message.messageHandler({sig:roomName,members:room.members, message:{ author: username, text: text, status: false, date: dateNow}});

                console.log('messageRoom enabledUsers: ',enabledUsers);
                for(let name of enabledUsers) {
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
                room = await room.reformatData();

                let roomMembers = room.members.map(itm => itm.username);
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:roomMembers,message:{author: username,text:"The group administrator "+username+" has added user "+bannedUser+" to the block list.",status: false,date: dateNow}});
                    for (let name of roomMembers){
                        if(globalChatUsers[name]) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageRoom',mes);
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
                room = await room.reformatData();

                let roomMembers = room.members.map(itm => itm.username);
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:roomMembers,message:{ author: username, text: "The group administrator "+username+" has removed user "+unbannedUser+" from the block list.", status: false, date: dateNow}});
                    for (let name of roomMembers){
                        if(globalChatUsers[name]) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageRoom',mes);
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
                room = await room.reformatData();
                let roomMembers = room.members.map(itm => itm.username);
                console.log('setRoomAdmin roomMembers: ',roomMembers);
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:roomMembers,message:{ author: username, text: username+" has appointed "+newAdminName+" a new administrator.", status: false, date: dateNow}});
                    console.log('setRoomAdmin mes: ',mes);
                    for (let name of roomMembers){
                        if(globalChatUsers[name]) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageRoom',mes);
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
                let room = await Room.findOne({
                    where:{name:roomName},
                    include:[
                        {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                        {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                    ]
                });
                let roomData = await room.reformatData();
                console.log('changeNtfStatus roomData: ',roomData);
                if(!roomData.members.some(itm => itm.username === username) || roomData.blockedMembers.some(itm => itm.username === username)) {
                    return cb("You are not a member of this group or you are on the block list.",null);
                }
                let status = roomData.members.find(itm => itm.username === username).enable;
                await UserRoom.update({
                    enable:!status
                },{
                    where:{
                        roomId:room._id,
                        userId:globalChatUsers[username]._id
                    }
                });

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
                    let ndUser = sig.filter(name => name !== username)[0];
                    if(!globalChatUsers[username].contacts.includes(ndUser)) return cb("Canceled. Attempted unauthorized access to data.",null);
                    //check: Is username member of correspondence?
                    if(!sig.includes(username) || sig.length > 2) return cb("Canceled. Attempted unauthorized access to data.",null);
                    sig = setGetSig(sig);
                }else {//room correspondence
                    //check: Is username member of room?
                    let room = await Room.findOne({
                        where:{name:sig},
                        include:[{model: User,as:'members'}, {model: User,as:'blockedMembers'},]
                    });
                    room = await room.reformatData();
                    console.log("members: ",room.members);
                    if(!room.members.some((name) => name === username)) return cb("Canceled. Attempted unauthorized access to data.",null);
                    console.log('findMessage, sig: ',sig," ,textSearch: ",textSearch);
                }
                let mesQuery = await Message.findAll({where:{
                    sig:sig,
                    text:{[Op.substring]:'%' + textSearch + '%'}
                },include:{model:User,as:'recipients'}});

                let promisesMes = mesQuery.map(itm => itm.reformatData());
                mesQuery = await Promise.all(promisesMes);
                mesQuery.sort((a,b) => a.createdAt - b.createdAt);
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
                //delete all messages with ids and sig
                if(await Room.findOne({where:{name:reqUsername}})) return cb("Rejected. Delete group history is not available!",null);
                if(!globalChatUsers[username].contacts.includes(reqUsername) && !globalChatUsers[username].blockedContacts.includes(reqUsername)) {
                    return cb("Rejected. User "+reqUsername+" is not in your lists!",null);
                }
                let usersMes = await Message.findAll({
                    where:{
                        _id:ids,
                        sig:setGetSig([username,reqUsername]),
                        //author:{[Op.or]:[username,reqUsername]}
                    }
                });
                console.log('deleteMessages, usersMes.length: ',usersMes.length,' ,ids.length: ',ids.length);
                if(usersMes.length !== ids.length) return cb("The attempt of unauthorized access to the messages. Not all the requested messages belong to you.",null);
                //
                await Message.destroy({where:{_id:ids,sig:setGetSig([username,reqUsername])}});
                //delete user's messages in messageStore
                if(globalChatUsers[reqUsername]) socket.broadcast.to(globalChatUsers[reqUsername].sockedId).emit('updateMessageStore',username,ids);
                cb(null)
            } catch (err) {
                console.log("deleteMessage err: ",err);
                cb(err)
            }
        });
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


