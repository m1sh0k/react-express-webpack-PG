var AuthError = require('../../error/index').AuthError;
var CryptoJS = require('crypto-js');
var util = require('util');
const Sequelize = require('sequelize');
const config = require('../../../config');
let pgConf = config.get('pg');
const sequelize = new Sequelize(pgConf.database,pgConf.username, pgConf.password, {
    host: 'localhost',
    dialect: 'postgres',
});
const { Op } = require("sequelize");
//////////////////////////////////////////////////////////////////
//Create MUser Table
const User = sequelize.define('user', {
    _id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        unique: true
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: Sequelize.VIRTUAL,
        set: function (pass){
            let salt = Math.random() + '';
            let hash = CryptoJS.HmacSHA1(pass,salt).toString(CryptoJS.enc.Hex);
            console.log("setPass : ",pass," ,hash: ",hash, " salt: ",salt);
            this.setDataValue('password', pass);
            this.setDataValue('salt', salt);
            this.setDataValue('hashedPassword', hash);
        },
    },
    hashedPassword:{
        type: Sequelize.STRING,
        allowNull: false,
    },
    salt:{
        type: Sequelize.STRING,
        allowNull: false,
    },
}, {tableName: 'user'});
User.sync();
//
var Contacts = sequelize.define('Contacts', {
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    contactId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
}, { timestamps: false,tableName: 'Contacts' });
Contacts.sync();
//
var BlockedContacts = sequelize.define('BlockedContacts', {
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    blockedContactId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
}, { timestamps: false,tableName: 'BlockedContacts' });
BlockedContacts.sync();
//
User.belongsToMany(User, {as:'contacts',otherKey:'contactId',foreignKey:'userId',through: 'Contacts'});
User.belongsToMany(User, {as:'blockedContacts',otherKey:'blockedContactId',foreignKey:'userId',through: 'BlockedContacts'});
//////////////////////////////////////////////////////////////////
//Create Room Table
var Room = sequelize.define('room', {
    _id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        unique: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
}, {tableName: 'room'});
Room.sync();
//
var RoomMembers = sequelize.define('RoomMembers', {
    roomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
}, { timestamps: false,tableName: 'RoomMembers' });
RoomMembers.sync();
//
var RoomBlockedMembers = sequelize.define('RoomBlockedMembers', {
    roomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
}, { timestamps: false,tableName: 'RoomBlockedMembers' });
RoomBlockedMembers.sync();
//
var UserRoom = sequelize.define('UserRoom', {
    roomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    enable:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue:false,
    },
    admin:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue:false,
    },
}, { timestamps: false,tableName: 'UserRoom' });
UserRoom.sync();
//
Room.belongsToMany(User, {as: 'members', through: RoomMembers});
//Magic methods setMembers, addMembers, removeMembers eth..
Room.belongsToMany(User, {as: 'blockedMembers', through: RoomBlockedMembers});
//Magic methods setBlockedMembers, addBlockedMembers, removeBlockedMembers eth..
User.belongsToMany(Room, {as:'rooms', through: UserRoom});
//Magic methods setRooms, addRooms, removeRooms eth..
//////////////////////////////////////////////////////////////////
//Create Message Table
const Message = sequelize.define('message', {
    _id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        unique: true
    },
    text: {//message text
        type: Sequelize.STRING,
        allowNull: false,
    },
    author:{
        type: Sequelize.STRING,
        allowNull: false,
    },
    sig: {//message text
        type: Sequelize.STRING,
        allowNull: false,
    },
    forwardFrom:{
        type: Sequelize.STRING,
    },
    date:{
        type: Sequelize.DATE,
        allowNull: false,
    },
}, {tableName: 'message'});
Message.sync();
//
const MessageData  = sequelize.define('MessageData', {
    messageId:{
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    userId:{
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    status:{//author
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue:false,
    },
});
MessageData.sync();
//
Message.belongsToMany(User, {as: 'recipients',through: MessageData});
Message.belongsTo(User, {foreignKey:'forwardFrom'});
Message.sync();
//////////////////////////////////////////////////////////////////

//message internal methods
Message.prototype.reformatData = async function() {
    let mes = this;
    mes = mes.toJSON();
    mes.recipients = mes.recipients.map((res)=>{
        return {username: res.username, status:res.MessageData.status}
    });
    return mes
};



//message methods
Message.messageHandler = async function (data,limit) {
    var Message = this;
    //let mes = {};
    let err = {};
    //let sig = setGetSig(data.members);
    console.log('DB messageHandler: ',data);
    try {
        if(data.message) {//write data
            if(!data.message.author || !data.message.date || !data.sig || !data.message.text) return {err:"Create Message. Not full request",mes:null};
            let mes = await Message.create({text: data.message.text,sig:data.sig,date:data.message.date,author:data.message.author});
            for (let name of data.members) {
                if(name !== data.message.author) await mes.addRecipient(await User.findOne({where:{username:name}}))
            }
            mes = await Message.findOne({
                where: {_id:mes._id},
                include:{
                    model:User,
                    as:'recipients',
                    attributes: ['username'],
                    through: {attributes: ['status']}
                }
            });
            mes = await mes.reformatData();
            return {err:null,mes:mes};//return current message
        }else {//read data and return log
            let mes = await Message.findAll({
                limit:limit,
                where:{sig:data.sig},
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
            return {err:null,mes: mes};
        }
    } catch(err) {
        console.log('messageHandler err: ',err);
        return {err:err,mes:null};
    }
};
//////////////////////////////////////////////////////////////////
//User internal methods
User.prototype.encryptPassword = function(password) {
    console.log("encryptPassword password: ",password);
    return CryptoJS.HmacSHA1(password,this.salt).toString(CryptoJS.enc.Hex);
};
//
User.prototype.checkPassword = function(password) {
    console.log("checkPassword password: ",password);
    return  this.encryptPassword(password) === this.hashedPassword;
};
//
User.prototype.reformatData = async function() {
    let nameUserDB = this;
    //console.log("reformatData: ",nameUserDB);
    nameUserDB = nameUserDB.toJSON();
    if(nameUserDB.contacts) nameUserDB.contacts = nameUserDB.contacts.map(itm => itm.username) || [];
    if(nameUserDB.blockedContacts) nameUserDB.blockedContacts = nameUserDB.blockedContacts.map(itm => itm.username) || [];
    if(nameUserDB.rooms) nameUserDB.rooms = nameUserDB.rooms.map(itm => itm.name)  || [];
    return nameUserDB
};
//user methods
User.authorize = async function(paramAuth) {
    let User = this;
    let user = {};
    let err = {};
    try {
        user = await User.findOne({where:{username: paramAuth.username}});
        console.log('async user:',user);
        if (user) {
            if(user.checkPassword(paramAuth.password)) {
                return {err:null,user:user};
            } else {
                err = new AuthError("Password is incorrect");
                console.log('user.err: ',err);
                return {err:err,user:null};
            }
        } else {
            err = new AuthError("User not found! ");
            console.log('user.err: ',err);
            return {err:err,user:null};
        }
    } catch (err) {
        console.log('authorize err: ',err);
        return {err:err,user:null};
    }
};
//
User.userATC = async function (reqUser,contact) {//AddToContacts
    let User = this;
    let user = {};
    console.log('userATC userReq: ',reqUser,",","moving contact: ",contact);
    try {
        if(reqUser === contact) return ({err:"Rejected, you tried to add themselves.",user:null});
        user = await User.findOne({
            where:{username:reqUser},
            include: [
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ],
        });
        console.log('AddToContacts user: ',user);
        if(!user) return ({err:"No user name "+reqUser+" found.",user:null});
        if(user.contacts.map(itm => itm.name).includes(contact)) return ({err:null,user:user});
        let newContact = await User.findOne({where:{username:contact}});
        if(!newContact) return ({err:"No user name "+contact+" found.",user:null});
        user = await user.addContacts(newContact);
        return ({err:null,user:user});
    } catch(err) {
        console.log('userATC err: ',err);
        return {err:err,user:null};
    }
};
//
User.userATBC = async function (reqUser,contact) {//AddToBlockedContacts
    let User = this;
    let user = {};
    console.log('userATBC userReq: ',reqUser,",","moving contact: ",contact);
    try {
        if(reqUser === contact) return ({err:"Rejected, you tried to add themselves.",user:null});
        user = await User.findOne({
            where:{username:reqUser},
            include: [
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ],
        });
        if(!user) return ({err:"No user name "+reqUser+" found.",user:null});
        if(user.blockedContacts.map(itm => itm.name).includes(contact)) return ({err:"You always add this user to Blocked contacts.",user:null});
        let newContact = await User.findOne({where:{username:contact}});
        if(!newContact) return ({err:"No user name "+contact+" found.",user:null});
        user = await user.addBlockedContacts(newContact);
        return ({err:null,user:user});
    } catch(err) {
        console.log('userATBC err: ',err);
        return {err:err,user:null};
    }
};
//
User.userMFBCTC = async function (reqUser,contact) {//MoveFromBlockedContactsToContacts
    let User = this;
    let user = {};
    //console.log('userMFBCTC userReq: ',reqUser,",","moving contact: ",contact);
    try {
        if(reqUser === contact) return ({err:"Rejected, you tried to add themselves.",user:null});
        user = await User.findOne({
            where:{username:reqUser},
            include:[
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
                ]
        });
        await user.reformatData();
        if(!user) return ({err:"No user name "+reqUser+" found.",user:null});
        if(user.contacts.includes(contact)) return ({err:"You always add this user to contacts.",user:null});
        let newContact = await User.findOne({where:{username:contact}});
        if(!newContact) return ({err:"No user name "+contact+" found.",user:null});
        await user.removeBlockedContacts(newContact);
        user = await user.addContacts(newContact);
        return {err:null,user:user};
    } catch(err) {
        console.log('userMFBCTC err: ',err);
        return {err:err,user:null};
    }
};
//
User.userMFCTBC = async function (reqUser,contact) {//MoveFromContactsToBlockedContacts
    let User = this;
    let user = {};
    //console.log('userMFBCTC userReq: ',reqUser,",","moving contact: ",contact);
    try {
        if(reqUser === contact) return ({err:"Rejected, you tried to add themselves.",user:null});
        user = await User.findOne({
            where:{username:reqUser},
            include:[
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ]
        });
        await user.reformatData();
        if(!user) return ({err:"No user name "+reqUser+" found.",user:null});
        if(user.blockedContacts.includes(contact)) return {err:"You always moved contact.",user:null};
        let newContact = await User.findOne({where:{username:contact}});
        if(!newContact) return ({err:"No user name "+contact+" found.",user:null});
        await user.removeContacts(newContact);
        user = await user.addBlockedContacts(newContact);
        return {err:null,user:user};
    } catch(err) {
        console.log('userMFCTBC err: ',err);
        return {err:err,user:null};
    }
};
//
User.userRFAL = async function (reqUser,contact) {//RemoveFromAllList
    let User = this;
    let user = {};
    console.log('userRFAL userReq: ',reqUser,",","moving contact: ",contact);
    try {
        user = await User.findOne({where:{username:reqUser}});
        if(!user) return ({err:"No user name "+reqUser+" found.",user:null});
        await user.removeContacts(contact);
        user = await user.removeBlockedContacts(contact);
        return {err:null,user:user};
    } catch(err) {
        console.log('userRFAL err: ',err);
        return {err:err,user:null};
    }
};
//
User.changeData = async function(paramAuth) {
    let User = this;
    let user = {};
    let err = {};
    try {
        user = await User.findOne({where:{username: paramAuth.oldUsername}});
        console.log('async changeData user:',user);
        let newUserName = await User.findOne({where:{username:paramAuth.newUsername}});
        if(newUserName) return {err:"New Username is already taken.",user:null};
        if (user) {
            if(user.checkPassword(paramAuth.oldPassword)) {
                user = await user.update({
                    username: paramAuth.newUsername,
                    password: paramAuth.newPassword
                },{
                    where:{
                        username:paramAuth.oldUsername
                    }
                });
                return {err:null,user:user};
            } else {
                err = new AuthError("Password is incorrect");
                console.log('user.err: ',err);
                return {err:err,user:null};
            }
        } else {
            err = new AuthError("Old Username is incorrect");
            console.log('user.err: ',err);
            return {err:err,user:null};
        }
    } catch (err) {
        console.log('changeData err: ',err);
        return {err:err,user:null};
    }
};
// //

// //room methods
// var User = mongoose.model('User', user);
// var Message = mongoose.model('Message', message);
//create new room and push roomName to user room list]


//Room internal methods
Room.prototype.reformatData = async function() {
    let nameUserDB = this;
    nameUserDB = nameUserDB.toJSON();
    //console.log("reformatData: ",nameUserDB);
    nameUserDB.members = nameUserDB.members.map((itm) => {
            if(itm.rooms){
                return {username:itm.username, enable:itm.rooms.find(rn => rn.name === nameUserDB.name).UserRoom.enable, admin:itm.rooms.find(rn => rn.name === nameUserDB.name).UserRoom.admin}
            } else return itm.username
        })  || [];
    nameUserDB.blockedMembers = nameUserDB.blockedMembers.map((itm) => {
            if(itm.rooms){
                return {username:itm.username, enable:itm.rooms.find(rn => rn.name === nameUserDB.name).UserRoom.enable, admin:itm.rooms.find(rn => rn.name === nameUserDB.name).UserRoom.admin}
            } else return itm.username
        })  || [];
    return nameUserDB
};
//
Room.createRoom = async function(roomName,username) {
    let Room = this;
    let room = {};
    let err = {};
    try {
        let user = await User.findOne({where:{username:username}});
        room = await Room.findOne({where:{name:roomName}});
        if(!room){
            room = await Room.create({name:roomName});
            //console.log('Room.createRoom room: ',Object.keys(room.__proto__));
            //console.log('Room.createRoom user: ',Object.keys(user.__proto__));
            await room.addMember(user);
            await user.addRoom(room,{through:{enable:true,admin:true}});
            await room.reload();
            await user.reload();
            //room = await Room.findOne({where:{name:roomName},include:[{model:User,as:'members'},{model:User,as:'blockedMembers'}]});
            return {err:null,room:room,user:user}
        }else{
            return {err:"A group named "+roomName+" already exists. Choose another group name.",room:null,user:null};
        }
    } catch (err) {
        console.log('createRoom err: ',err);
        return {err:err,room:null,user:null};
    }
};
// //invite user to room
Room.inviteUserToRoom = async function(roomName,invited) {
    let Room = this;
    let err = {};
    try {
        let userArray = [];

        let room = await Room.findOne({
            where:{name:roomName},
            include:[
                {model: User,as:'members'},
                {model: User,as:'blockedMembers'}
            ]
        });

        if(Array.isArray(invited)) {
            for(let itm of invited) {
                let user = await User.find({where:{username:itm}});
                let userData = user.reformatData();
                if(userData.blockedContacts.includes(roomName)) continue;//return {err:"User "+invited+" include group named "+roomName+" in block list.",room:null,user:null};
                await user.addRoom(room,{through:{enable:true,admin:false}});
                userArray.push(user);
            }
            await room.addMembers(userArray);
            await room.reload();
            //room = await findOne({where:{name:roomName},include:[{model:User,as:'members'},{model:User,as:'blockedMembers'}]});
            return {err:null,room:room,user:userArray};
        } else {
            let user = await User.findOne({
                where:{username:invited},
                include: [
                    {model: User,as:'contacts'},
                    {model: User,as:'blockedContacts'},
                ],
            });
            let userData = await user.reformatData();
            let roomData = await room.reformatData();
            console.log('inviteUserToRoom userData: ',userData);
            console.log('inviteUserToRoom roomData: ',roomData);
            if(roomData.members.includes(invited)) return {err:"User "+invited+" is already included in the group.",room:null,user:null};
            if(roomData.blockedMembers.includes(invited)) return {err:"User "+invited+" is included in the block list.",room:null,user:null};
            if(userData.blockedContacts.includes(roomName)) return {err:"User "+invited+" include group named "+roomName+" in block list.",room:null,user:null};
            await room.addMember(user);
            await user.addRoom(room,{through:{enable:true,admin:false}});
            await room.reload();
            await user.reload();
            //room = await Room.findOne({where:{name:roomName},include:[{model:User,as:'members'},{model:User,as:'blockedMembers'}]});
            //user = await User.findOne({where:{username:invited},include:{model:Room,as:'rooms'}});
            return {err:null,room:room,user:user};
        }
    } catch (err) {
        console.log('inviteUserToRoom err: ',err);
        return {err:err,room:null,user:null};
    }
};
//leave  room
Room.leaveRoom = async function(roomName,name) {
    let Room = this;
    let err = {};
    try {
        let user = await User.findOne({where:{username:name}});
        let room = await Room.findOne({where:{name:roomName},include:[{model:User,as:'members'},{model:User,as:'blockedMembers'}]});
        let roomData = room.reformatData();
        //if(roomData.members.find(itm => itm.name === name).admin === true) return {err:"You can not leave this group. You are admin.",room:null,user:null};
        await user.removeRoom(room);
        await room.removeMember(user);
        room = await Room.findOne({where:{name:roomName},include:[{model:User,as:'members'},{model:User,as:'blockedMembers'}]});
        roomData = await room.reformatData();
        console.log('Room.leaveRoom room:',roomData);
        if(roomData.members.length === 0) {
            //Delete room protocol. if no one user left.
            for(let itm of roomData.blockedMembers) {
                let user = await User.findOne({where:{username:name}});
                await user.removeRoom(room)
            }
            let mes = await Message.findAll({where:{sig:roomName}});
            let mesArr = mes.map(itm => itm._id);
            await room.setBlockedMembers([]);
            await Room.destroy({where: {_id: room._id}});
            await Message.destroy({where:{[Op.in]:mesArr}});
            console.log("Delete room protocol successful done");
            return {err:null,room:null,user:user};
        }
        return {err:null,room:roomData,user:user};
    } catch (err) {
        console.log('leaveRoom err: ',err);
        return {err:err,room:null,user:user};
    }
};
//block user in room
Room.blockUserInRoom = async function(roomName,adminRoom,blocked) {
    let Room = this;
    let err = {};
    try {
        let room = await Room.findOne({
            where:{name:roomName},
            include:[
                {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                ]
        });
        let roomData = await room.reformatData();
        console.log("blockUserInRoom room: ",roomData);
        if(roomData.members.find(itm => itm.username === adminRoom).admin !== true) return {err:"You are not admin of this group.",room:null};
        if(roomData.members.find(itm => itm.username === blocked).admin === true) return {err:"You can not block a group administrator.",room:null};
        if(!roomData.members.some(itm => itm.username === blocked) || roomData.blockedMembers.some(itm => itm.username === blocked)) return {err:"User "+blocked+" is not a member of this group or is already on the block list.",room:null};
        let userBlocked = await User.findOne({where:{username:blocked}});
        await room.removeMember(userBlocked);
        await room.addBlockedMember(userBlocked);
        await room.reload();
        return {err:null,room:room};
    } catch (err) {
        console.log('blockUserInRoom err: ',err);
        return {err:err,room:null};
    }
};
//unblock user in room
Room.unblockUserInRoom = async function(roomName,adminRoom,unblocked) {
    let Room = this;
    let err = {};
    try {
        let room = await Room.findOne({
            where:{name:roomName},
            include:[
                {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
            ]
        });
        let roomData = await room.reformatData();
        if(roomData.members.find(itm => itm.username === adminRoom).admin !== true) return {err:"You are not admin of this group.",room:null};
        if(roomData.members.some(itm => itm.username === unblocked) || !roomData.blockedMembers.some(itm => itm.username === unblocked)) return {err:"User "+unblocked+" is an allowed members of this group.",room:null};
        let userUnblocked = await User.findOne({where:{username:unblocked}});
        await room.removeBlockedMember(userUnblocked);
        await room.addMember(userUnblocked);
        await room.reload();
        return {err:null,room:room};
    } catch (err) {
        console.log('unblockUserInRoom err: ',err);
        return {err:err,room:null};
    }
};
//set admin room
Room.setAdminInRoom = async function(roomName,adminRoom,newAdmin) {
    console.log("setAdminInRoom roomName:",roomName, " ,adminRoom: ",adminRoom," ,newAdmin: ",newAdmin)
    let Room = this;
    let err = {};
    try {
        let room = await Room.findOne({
            where:{name:roomName},
            include:[
                {model: User,as:'members',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
                {model: User,as:'blockedMembers',include:{model:Room,as:'rooms',attributes: ['name'],through:{attributes: ['enable','admin']}}},
            ]
        });
        let roomData = await room.reformatData();
        if(roomData.members.find(itm => itm.username === adminRoom).admin !== true) return {err:"You are not admin of this group.",room:null};
        if(!roomData.members.some(itm => itm.username === newAdmin) || roomData.blockedMembers.some(itm => itm.username === newAdmin)) {
            return {err:"User "+newAdmin+" is not a member of this group or is already on the block list.",room:null};
        }
        if(roomData.members.find(itm => itm.username === newAdmin).admin === true) return {err:"User "+newAdmin+" is already admin of this group.",room:null};
        let userNewAdmin = await User.findOne({where:{username:newAdmin}});
        console.log("setAdminInRoom room._id:",room._id," ,userNewAdmin._id: ",userNewAdmin._id);
        await UserRoom.update({
            admin:true
        },{
            where:{
                roomId:room._id,
                userId:userNewAdmin._id
            }
        });
        await room.reload();
        return {err:null,room:room};
    } catch (err) {
        console.log('setAdminInRoom err: ',err);
        return {err:err,room:null};
    }
};

//
// module.exports.User = mongoose.model('User', user);
// module.exports.Room = mongoose.model('Room', room);
// module.exports.Message = mongoose.model('Message', message);

module.exports.User = User;
module.exports.Message = Message;
module.exports.Room = Room;
module.exports.MessageData = MessageData;




