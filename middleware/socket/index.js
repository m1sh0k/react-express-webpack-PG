var config = require('./../../config');
var cookie = require('cookie');
var sessionStore = require('../db/sessionStore');
var HttpError = require('./../error/index').HttpError;
var DevError = require('./../error/index').DevError;
var User = require('../db/models/index').User;
var Contacts = require('../db/models/index').Contacts;
var BlockedContacts = require('../db/models/index').BlockedContacts;
var Message = require('../db/models/index').Message;
var Room = require('../db/models/index').Room;
var Channel = require('../db/models/index').Channel;
var MessageData = require('../db/models/index').MessageData;
var UserRoom = require('../db/models/index').UserRoom;
var ChannelUser = require('../db/models/index').ChannelUser;
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
                {model: Channel,as:'channels'},
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ],
        });

        let userData = await data.reformatData();
        console.log('test agrReFormatData: ', userData);
        let contacts = userData.contacts || [];
        let blockedContacts = userData.blockedContacts || [];
        let rooms = userData.rooms || [];
        let channels = userData.channels || [];


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
            let contData = await Contacts.findOne({where:{userId:userData._id, contactId:nameUserDB._id}});
            //console.log("aggDataRooms contData: ",contData);
            let banned = nameUserDB.blockedContacts.includes(username);
            let authorized =  !(!nameUserDB.contacts.includes(username) && !nameUserDB.blockedContacts.includes(username));
            let {err,mes} = await Message.messageHandler({sig:setGetSig([username,name])});

            let col = mes.filter(itm => itm.author !== username && itm.recipients[0].status === false).length;
            return contacts[i] = {
                name:name,
                msgCounter :col,
                allMesCounter: mes.length,
                typing:false,
                onLine:status,
                banned:banned,
                authorized:authorized,
                created_at:nameUserDB.createdAt,
                userId:nameUserDB._id,
                enable:contData.enable,
                sortId:contData.sortId
            }
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
            let bContData = await BlockedContacts.findOne({where:{userId:userData._id, blockedContactId:nameUserDB._id}});
            return blockedContacts[i] = {
                name:name, msgCounter :col,
                allMesCounter: mes.length,
                typing:false, onLine:status,
                banned:banned,
                authorized:authorized,
                created_at:nameUserDB.createdAt,
                userId:nameUserDB._id,
                sortId:bContData.sortId
            }
        });
        let rL = rooms.map(async (name,i) =>{
            let data = await Room.findOne({
                where:{name:name},
                include: [
                    {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                    {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                ],
            });
            let room = await data.reformatData();
            let {err,mes} = await Message.messageHandler({sig:name});
            let mesFltr = mes.filter(itm => itm.author !== username && itm.recipients.some(itm => itm.username === username) && !itm.recipients.find(itm => itm.username === username).status);
            let roomData = await UserRoom.findOne({where:{userId:userData._id, roomId:room._id}});
            //console.log('aggDataRooms mesFltr: ',mesFltr.length);
            return rooms[i] = {
                name:name,
                msgCounter:mesFltr.length,
                allMesCounter:mes.length,
                members:room.members,
                blockedMembers:room.blockedMembers,
                created_at:room.createdAt,
                groupId:room._id,
                sortId:roomData.sortId
            }
        });
        let cL = channels.map(async (name,i) =>{
            let data = await Channel.findOne({
                where:{name:name},
                include: [
                    {model: User,as:'members',include:{model:Channel,as:'channels',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                ],
            });
            let channel = await data.reformatData();
            let {err,mes} = await Message.messageHandler({sig:name});
            let mesFltr = mes.filter(itm => itm.author !== username && itm.recipients.some(itm => itm.username === username) && !itm.recipients.find(itm => itm.username === username).status);
            let channelData = await ChannelUser.findOne({where:{userId:userData._id, channelId:channel._id}});
            //console.log('aggDataRooms mesFltr: ',mesFltr.length);
            return channels[i] = {
                name:name,
                msgCounter:mesFltr.length,
                allMesCounter:mes.length,
                members:channel.members,
                created_at:channel.createdAt,
                channelId:channel._id,
                sortId:channelData.sortId
            }
        });
        userData.contacts = await Promise.all(wL);
        userData.contacts.sort((a,b)=> a.sortId > b.sortId);
        userData.blockedContacts = await Promise.all(bL);
        userData.blockedContacts.sort((a,b)=> a.sortId > b.sortId);
        userData.rooms = await Promise.all(rL);
        userData.rooms.sort((a,b)=> a.sortId > b.sortId);
        userData.channels = await Promise.all(cL);
        userData.channels.sort((a,b)=> a.sortId > b.sortId);
        //console.log("aggregateUserData: ",username,": ",userData);
        return userData;
    } catch (err) {
        console.log("aggregateUserData err: ",err);
        return new DevError(500, 'Aggregate User Data error: ' + err);
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
            if(!user) return callback(JSON.stringify(new  HttpError(401, 'Anonymous session unable to connect ')));
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
            channels:userDB.channels.map(itm => itm.name) || [],
        };
        //console.log('connection globalChatUsers: ',globalChatUsers);
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
                console.log("deleteUser userRG:",userRG);
                //update globalChatUsers[username] data
                globalChatUsers[username].contacts = userRG.contacts.map(itm => itm.username);
                globalChatUsers[username].blockedContacts = userRG.blockedContacts.map(itm => itm.username);
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
                users = users.map(itm => itm.username)
                    .filter(name => name !== username)
                    .filter(name => !globalChatUsers[username].contacts.includes(name))
                    .filter(name => !globalChatUsers[username].blockedContacts.includes(name));
                let rooms = await Room.findAll({where: {name:{[Op.iLike]: '%' + nameString + '%'}}});
                rooms = rooms.map(itm => itm.name).filter(name => !globalChatUsers[username].rooms.includes(name));
                let channels = await Channel.findAll({where: {name:{[Op.iLike]: '%' + nameString + '%'}}});
                channels = channels.map(itm => itm.name).filter(name => !globalChatUsers[username].channels.includes(name));

                let findedArr = {users:users,rooms:rooms,channels:channels};
                console.log("findContacts findedArr:",findedArr);
                return  cb(null,findedArr);
            } catch (err) {
                console.log("findContacts err:",err);
                return cb(err,null)
            }
        });
        //change items position in user,group or channel lists
        socket.on('changeItmPosArray', async function (itmType,modifiedArray,cb) {
            try {
                console.log('changeItmPosArray itmType: ', itmType, ', modifiedArray: ', modifiedArray);
                let usId = globalChatUsers[username]._id;
                console.log('changeItmPosArray usId: ', usId);
                switch (itmType) {
                    case 'contacts':
                        for (let itm of modifiedArray) {
                            await Contacts.update({
                                sortId:itm.sortId
                            },{
                                where:{
                                    userId: usId,
                                    contactId: itm.userId
                                }
                            });
                        }
                        break;
                    case 'blockedContacts':
                        for (let itm of modifiedArray) {
                            await BlockedContacts.update({
                                sortId:itm.sortId
                            },{
                                where:{
                                    userId: usId,
                                    contactId: itm.userId
                                }
                            });
                        }
                        break;
                    case 'rooms':
                        for(let itm of modifiedArray){
                            await UserRoom.update({
                                sortId:itm.sortId
                            },{
                                where:{
                                    roomId:itm.groupId,
                                    userId:usId
                                }
                            });
                        }
                        break;
                    case 'channels':
                        for(let itm of modifiedArray){
                            await ChannelUser.update({
                                sortId:itm.sortId
                            },{
                                where:{
                                    channelId:itm.channelId,
                                    userId:usId
                                }
                            });
                        }
                        break;
                    default:
                        console.log("changeItmPosArray sound Sorry, we are out of itmType: " + itmType + ".");
                }
                return cb(null);
            } catch (err) {
                console.log("changeItmPosArray err:",err);
                return cb(err)
            }
        });
        //Check contact
        socket.on('checkContact', async function (nameId,cb) {
            console.log('checkContact: ',nameId);
            let user;
            user = await User.findOne({where:{
                [Op.or]:[{_id:nameId}, {username:nameId}]
            }})
            if(user) {
                user = await user.reformatData();
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
        socket.on('setMesStatus',async function (idx,itmType,itmName,cb) {
            try {
                console.log("setMesStatus: indexArr: ",idx," ,itmType: ",itmType,' ,itmName: ',itmName);
                let reqUser,reqRoom,reqChannel;
                let user = await User.findOne({where:{username:username}});//set user message status

                await MessageData.update(
                    {status: true},
                    {where:{
                            messageId:idx,
                            userId:user._id
                        }
                    });
                switch (itmType) {
                    case "users":
                        reqUser = await User.findOne({where:{username:itmName}});//set user message status
                        if(globalChatUsers[itmName]) socket.broadcast.to(globalChatUsers[itmName].sockedId).emit('updateMsgStatus',itmType,username,idx,null);
                        break;
                    case "rooms":
                        reqRoom = await Room.findOne({where:{name:itmName},include:[{model:User,as:'members'},{model:User,as:'blockedMembers'}]});//set room message status
                        reqRoom = await reqRoom.reformatData();
                        for(let name of reqRoom.members) {
                            if(globalChatUsers[name] && name !== username) socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateMsgStatus',itmType,itmName,idx,username);
                        }
                        break;
                    case "channels":
                        reqChannel = await Channel.findOne({where:{name:itmName},include:[{model:User,as:'members'}]});//set channel message status
                        for(let name of reqChannel.members) {
                            if(globalChatUsers[name] && name !== username) socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateMsgStatus',itmType,itmName,idx,username);
                        }
                        break;
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
                    case "contacts":
                        //from users
                        switch (arrayFrowardTo){
                            case "contacts":
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
                                socket.broadcast.to(globalChatUsers[to].sockedId).emit('messageForward', forwardedMesArr,"users",username);
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
                                    if(globalChatUsers[name]) socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageForward', forwardedMesArr,"rooms",to);
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
                            case "contacts":
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
                                socket.broadcast.to(globalChatUsers[to].sockedId).emit('messageForward', forwardedMesArr,"users",username);
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
                                    if(globalChatUsers[name]) socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageForward', forwardedMesArr,"rooms",to);
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
        //join To Room
        socket.on('joinToRoom', async function(roomName,dateNow,cb){
            try{
                console.log('joinToRoom: ',roomName,', joinedUser: ',username);
                let {err,room,user} = await Room.joinToRoom(roomName,username);

                if(err) {
                    return cb(err,null,null)
                } else {
                    room = await room.reformatData();
                    console.log('joinToRoom room: ',room);
                    let rCreator = room.members.find(itm => itm.creator === true).username;
                    console.log('joinToRoom roomCreator: ',rCreator);
                    let {err,mes} = await Message.messageHandler({
                        sig:roomName,
                        members:room.members.map(itm => itm.username),
                        message:{ author: rCreator, text: username+" joined to group.", status: false, date: dateNow}});
                    for (let name of room.members) {
                        if(globalChatUsers[name] && name !== username) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageChannel',mes);
                        }
                    }
                    globalChatUsers[username].rooms.push(roomName);
                    cb(null,await aggregateUserData(username),mes)
                }

            } catch(err){
                console.log("joinToRoom err: ",err);
            }

        })
        //leave room
        socket.on('leaveRoom', async function  (roomName,dateNow,cb) {
            try {
                console.log("leaveRoom: ",roomName);
                let {err,room,user} = await Room.leaveRoom(roomName,username);
                if(err) {
                    console.log('leaveRoom err: ',err);
                    return cb(err,null)
                }
                else {
                    room = await room.reformatData();
                    console.log('leaveRoom room: ',room);
                    let rCreator = room.members.find(itm => itm.creator === true).username;
                    let members = room.members.map(itm => itm.username);
                    let {err,mes} = await Message.messageHandler({sig:roomName,members:members,message:{ author: rCreator, text: username+" left the group.", status: false, date: dateNow}});
                    for (let name of members) {
                        if(globalChatUsers[name]) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageChannel',mes);
                        }
                    }
                    globalChatUsers[username].rooms = globalChatUsers[username].rooms.filter(chN => chN !== roomName);
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
                        {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                        {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
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
                        {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                        {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                    ],
                });
                let roomData = await room.reformatData();
                let members = roomData.members.map(itm => itm.username);
                let blockedMembers = room.blockedMembers.map(itm => itm.username);
                console.log('messageChannel members: ',members);
                // room.members = room.members.map(itm => itm.username);
                // room.blockedMembers = room.blockedMembers.map(itm => itm.username);
                if(!members.includes(username)) return cb("You are not a member of the group.",null);
                if(blockedMembers.includes(username)) return cb("You have been included in the block list. Send messages to you is no longer available.",null);
                let {err,mes} = await Message.messageHandler({sig:roomName,members:members, message:{ author: username, text: text, status: false, date: dateNow}});
                for(let name of members) {
                    if(globalChatUsers[name] && name !== username) socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageRoom',mes);
                }
                cb(null,mes);
            } catch (err) {
                console.log("messageRoom err: ",err);
                cb(err,null);
            }
        });
        //block user in room
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
        //enable/disable notification in room
        socket.on('chgRNtfStatus', async function  (roomName,cb) {
            try {
                console.log('changeNtfStatus roomName: ',roomName);
                let room = await Room.findOne({
                    where:{name:roomName},
                    include:[
                        {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                        {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
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
        //enable/disable notification in channel
        socket.on('chgChNtfStatus', async function  (channelName,cb) {
            try {
                console.log('changeNtfStatus channelName: ',channelName);
                let channel = await Channel.findOne({
                    where:{name:channelName},
                    include:[
                        {model: User,as:'members',include:{model:Channel,as:'channels',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                    ]
                });
                let channelData = await channel.reformatData();
                console.log('changeNtfStatus roomData: ',channelData);
                if(!channelData.members.some(itm => itm.username === username)) {
                    return cb("You are not a member of this channel or you are on the block list.",null);
                }
                let status = channelData.members.find(itm => itm.username === username).enable;
                await ChannelUser.update({
                    enable:!status
                },{
                    where:{
                        channelId:channel._id,
                        userId:globalChatUsers[username]._id
                    }
                });

                cb(null,await aggregateUserData(username))
            } catch (err) {
                console.log("setRoomAdmin err: ",err);
                cb(err,null)
            }
        });
        //enable/disable user notification status
        socket.on('chgUNtfStatus', async function  (userName,cb) {
            try {
                console.log('changeNtfStatus userName: ',userName);
                let user = await User.findOne({
                    where:{username:username},
                    include:[
                        {model: User,as:'contacts'}
                    ]
                });
                console.log('changeNtfStatus user.contacts: ',user.contacts.find(itm => itm.username === userName).Contacts);
                let userData = await user.reformatData();
                if(!userData.contacts.includes(userName)) return cb("You are not in contact list of this user or did not authorized.",null);
                let contact = user.contacts.find(itm => itm.username === userName);
                console.log('changeNtfStatus contact: ',contact);
                let status = contact.Contacts.enable

                await Contacts.update({
                    enable:!status
                },{
                    where:{
                        userId:user._id,contactId:contact._id
                    }
                });
                cb(null,await aggregateUserData(username))
            } catch (err) {
                console.log("chgUNtfStatus err: ",err);
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
                if(await Channel.findOne({where:{name:reqUsername}})) return cb("Rejected. Delete channel history is not available!",null);
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
        //channel events
        //create new channel
        socket.on('createChannel', async function  (channelName,dateNow,cb) {
            try {
                console.log('createChannel: ',channelName);
                let {err,channel,user} = await Channel.createChannel(channelName,username);
                console.log('createChannel: ',channel);
                if(err) {
                    return cb(err,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:channelName,members:channel.members,message:{ author: username, text: username+" created a new channel "+channelName+".", status: false, date: dateNow}});
                    return cb(null,await aggregateUserData(username))
                }
            } catch (err) {
                console.log("createRoom err: ",err);
                cb(err,null)
            }
        });
        //invite users to channel
        socket.on('inviteUserToChannel', async function  (channelName,invitedUser,dateNow,cb) {
            try {
                console.log('inviteUserToChannel: ',channelName, ' ,invitedUser: ',invitedUser);
                let {err,channel,user} = await Channel.inviteUserToChannel(channelName,invitedUser,username);
                channel = await channel.reformatData();
                if(err) {
                    return cb(err,null,null)
                } else {
                    let {err,mes} = await Message.messageHandler({sig:channelName,members:channel.members, message:{ author: username, text: username+" added new user "+invitedUser+".", status: false, date: dateNow}});
                    for (let name of channel.members) {
                        if(globalChatUsers[name] && name !== username) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageChannel',mes);
                        }
                    }
                    cb(null,await aggregateUserData(username),mes)
                }
            } catch (err) {
                console.log("inviteUserToChannel err: ",err);
                cb(err,null,null)
            }
        });
        //join To Channel
        socket.on('joinToChannel', async function(channelName,dateNow,cb){
            try{
                console.log('joinToChannel: ',channelName,', joinedUser: ',username);
                let {err,channel,user} = await Channel.joinToChannel(channelName,username);

                if(err) {
                    return cb(err,null,null)
                } else {
                    channel = await channel.reformatData();
                    console.log('joinToChannel channel: ',channel);
                    let chCreator = channel.members.find(itm => itm.creator === true).username;
                    console.log('joinToChannel channelCreator: ',chCreator);
                    let {err,mes} = await Message.messageHandler({
                        sig:channelName,
                        members:channel.members.map(itm => itm.username),
                        message:{ author: chCreator, text: username+" joined to channel.", status: false, date: dateNow}});
                    for (let name of channel.members) {
                        if(globalChatUsers[name] && name !== username) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageChannel',mes);
                        }
                    }
                    globalChatUsers[username].channels.push(channelName);
                    cb(null,await aggregateUserData(username),mes)
                }

            } catch(err){
                console.log("joinToChannel err: ",err);
            }

        })
        //leave channel
        socket.on('leaveChannel', async function  (channelName,dateNow,cb) {
            try {
                console.log("leaveChannel: ",channelName);
                let {err,channel,user} = await Channel.leaveChannel(channelName,username);

                if(err) {
                    console.log('leaveChannel err: ',err);
                    return cb(err,null)
                }
                else {
                    channel = await channel.reformatData();
                    console.log('leaveChannel channel: ',channel);
                    let chCreator = channel.members.find(itm => itm.creator === true).username;
                    let members = channel.members.map(itm => itm.username);
                    let {err,mes} = await Message.messageHandler({sig:channelName,members:members,message:{ author: chCreator, text: username+" left the channel.", status: false, date: dateNow}});
                    for (let name of members) {
                        if(globalChatUsers[name]) {
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('updateUserData',await aggregateUserData(name));
                            socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageChannel',mes);
                        }
                    }
                    globalChatUsers[username].channels = globalChatUsers[username].channels.filter(chN => chN !== channelName);
                    cb(null,await aggregateUserData(username))
                }
            } catch (err) {
                console.log("leaveChannel err: ",err);
                cb(err,null)
            }
        });
        //channel message handler
        socket.on('messageChannel', async function  (text,channelName,dateNow,cb) {
            try {
                console.log('messageChannel text: ',text, 'channelName: ',channelName, 'dateNow: ',dateNow);
                if (text.length === 0) return;
                if (text.length >= 500) return cb("To long message.",null);
                let channel = await Channel.findOne({
                    where:{name:channelName},
                    include: [
                        {model: User,as:'members',include:{model:Channel,as:'channels',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                    ],
                });
                let channelData = await channel.reformatData();
                let members = channelData.members.map(itm => itm.username);
                console.log('messageChannel members: ',members);

                if(!members.includes(username)) return cb("You are not a member of this channel.",null);
                if(!channelData.members.find(itm => itm.username === username).admin) return cb("You are not a admin of this channel.",null);
                let {err,mes} = await Message.messageHandler({sig:channelName,members:members, message:{ author: username, text: text, status: false, date: dateNow}});
                for(let name of members) {
                    if(globalChatUsers[name] && name !== username) socket.broadcast.to(globalChatUsers[name].sockedId).emit('messageChannel',mes);
                }
                cb(null,mes);
            } catch (err) {
                console.log("messageChannel err: ",err);
                cb(err,null);
            }
        });
        //get channel log
        socket.on('getChannelLog', async function  (channelName,reqMesCountCb,reqMesId,cb) {
            try {
                console.log("getChannelLog: ",channelName);
                let channel = await Channel.findOne({
                    where:{name:channelName},
                    include: [
                        {model: User,as:'members',include:{model:Channel,as:'channels',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                    ],
                });
                channel = await channel.reformatData();
                console.log("getChannelLog channel: ",channel);
                if(!channel) return cb("Error Channel do not exist!",null);
                if(!channel.members.some(itm => itm.username === username)) return cb("You are not a member of the channel.",null);

                if(!reqMesId) {
                    var {err,mes} = await Message.messageHandler({sig:channelName},reqMesCountCb);
                    if(err) return cb(err,null);
                }else {
                    mes = await Message.findAll({
                        where:{
                            sig:channelName,
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
    });
    return io;
};


