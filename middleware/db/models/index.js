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
//Create User Table
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
const Contacts = sequelize.define('Contacts', {
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
const BlockedContacts = sequelize.define('BlockedContacts', {
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
    if(nameUserDB.channels) nameUserDB.channels = nameUserDB.channels.map(itm => itm.name)  || [];
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
        let contactDell = await User.findOne({where:{username:contact}});
        if(!contactDell) return ({err:"No user name "+contactDell+" found.",user:null});
        if(!user) return ({err:"No user name "+reqUser+" found.",user:null});
        await user.removeContacts(contactDell);
        await user.removeBlockedContacts(contactDell);
        await user.reload();
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
    action:{
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
//Create Room Table
const Room = sequelize.define('room', {
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
    private:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue:false,
    }
}, {tableName: 'room'});
Room.sync();
//
const RoomMembers = sequelize.define('RoomMembers', {
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
const RoomBlockedMembers = sequelize.define('RoomBlockedMembers', {
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
const UserRoom = sequelize.define('UserRoom', {
    roomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    enable:{//NtfStatus
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
//room methods
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
            //await room.reload();
            await user.reload();
            room = await Room.findOne({where:{name:roomName},include:[{model:User,as:'members'},{model:User,as:'blockedMembers'}]});
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
        await user.reload();
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
            console.log("Message.destroy arr: ",mesArr);
            await Message.destroy({where: {_id: mesArr}});
            console.log("Delete room protocol successful done");
            return {err:null,room:null,user:user};
        }
        return {err:null,room:roomData,user:user};
    } catch (err) {
        console.log('leaveRoom err: ',err);
        return {err:err,room:null,user:null};
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
            return {err:"User "+newAdmin+" is not a member of this group or is already to the block list.",room:null};
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
//joinToRoom
Room.joinToRoom = async function(roomName,joined) {
    console.log('joinToChannel channelName: ',roomName, ', joined: ',joined);
    let Room = this;
    let err = {};
    try {
        let user = await User.findOne({
            where:{username:joined},
            include: [
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ],
        });
        let room = await Room.findOne({
            where:{name:roomName},
            include:[
                {model: User,as:'members'},
                {model: User,as:'blockedMembers'},
            ]
        });
        let userData = await user.reformatData();
        let roomData = await room.reformatData();
        console.log('joinToChannel userData: ',userData);
        console.log('joinToChannel channelData: ',roomData);

        if(roomData.members.includes(joined)) return {err:"User "+joined+" is already included in the group.",room:null,user:null};
        if(roomData.blockedMembers.includes(joined)) return {err:"You are included to the block list.",room:null,user:null};
        if(roomData.private) return {err:"The group is private. Entry by invitation only.",room:null,user:null};
        if(userData.blockedContacts.includes(roomName)) return {err:"You include group named "+roomName+" to the block list.",room:null,user:null};
        await room.addMember(user);
        await user.addRoom(room,{through:{enable:true}});
        await room.reload();
        await user.reload();
        console.log('joinToRoom room: ',room);
        return {err:null,room:channel,user:user};
    } catch (err) {
        console.log('joinToChannel err: ',err);
        return {err:err,room:null,user:null};
    }
};
//////////////////////////////////////////////////////////////////
//Create User Table
const Channel = sequelize.define('channel', {
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
    private:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue:false,
    }
}, {tableName: 'channel'});
Channel.sync();
//
const ChannelUser = sequelize.define('ChannelUser', {
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    channelId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    enable:{//NtfStatus
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue:false,
    },
    admin:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue:false,
    },
    creator:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue:false,
    },

}, { timestamps: false,tableName: 'channelUser' });
ChannelUser.sync();
Channel.belongsToMany(User, {as: 'members', through: ChannelUser});
//Magic methods setMember, addMember, removeMember eth..
User.belongsToMany(Channel, {as:'channels', through: ChannelUser});
//Magic methods setChannels, addChannel, removeChannel eth..
//Channel internal methods
Channel.prototype.reformatData = async function() {
    let nameUserDB = this;
    nameUserDB = nameUserDB.toJSON();
    //console.log("Channel reformatData: ",nameUserDB);
    nameUserDB.members = nameUserDB.members.map((itm) => {
        if(itm.channels){
            return {
                username:itm.username,
                enable:itm.channels.find(cn => cn.name === nameUserDB.name).ChannelUser.enable,
                admin:itm.channels.find(cn => cn.name === nameUserDB.name).ChannelUser.admin,
                creator:itm.channels.find(cn => cn.name === nameUserDB.name).ChannelUser.creator
            }
        } else return itm.username
    })  || [];
    //console.log("Channel reformatData out: ",nameUserDB);
    return nameUserDB
};
//
//Channel methods
Channel.createChannel = async function(channelName,username,privateOpt) {
    let Channel = this;
    let err = {};
    try {
        let user = await User.findOne({where:{username:username}});
        let channel = await Channel.findOne({where:{name:channelName}});
        if(!channel){
            if(privateOpt) channel = await Channel.create({name:channelName,private:privateOpt});
            channel = await Channel.create({name:channelName});
            console.log('Channel.createChannel: ',Object.keys(channel.__proto__));
            //console.log('Channel.createRoom user: ',Object.keys(user.__proto__));
            await channel.addMember(user);
            await user.addChannel(channel,{through:{enable:true,admin:true,creator:true}});
            //await channel.reload();
            //await user.reload();
            user = await User.findOne({where:{username:username},include:{model:Channel,as:'channels'}})
            channel = await Channel.findOne({where:{name:channelName},include:[
                    {model: User,as:'members',include:{model:Channel,as:'channels',attributes: ['name'],through:{attributes: ['enable','admin','creator']}}},
                ]});

            //console.log('Channel.createChannel user: ',user);
            //console.log('Channel.createChannel: ',channel);
            return {err:null,channel:channel,user:user}
        }else{
            return {err:"A channel named "+channelName+" already exists. Choose another group name.",channel:null,user:null};
        }
    } catch (err) {
        console.log('createChannel err: ',err);
        return {err:err,channel:null,user:null};
    }
};

Channel.inviteUserToChannel = async function(channelName,invited,inviter) {
    console.log('inviteUserToChannel channelName: ',channelName, ', invited: ',invited);
    let Channel = this;
    let err = {};
    try {
        let user = await User.findOne({
            where:{username:invited},
            include: [
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ],
        });
        let channel = await Channel.findOne({
            where:{name:channelName},
            include:[
                {model: User,as:'members'},
            ]
        });
        let userData = await user.reformatData();
        let channelData = await channel.reformatData();
        console.log('inviteUserToChannel userData: ',userData);
        console.log('inviteUserToChannel channelData: ',channelData);
        if(!channelData.members.includes(inviter)) return {err:"You are not channel member.",channel:null,user:null};
        if(channelData.members.includes(invited)) return {err:"User "+invited+" is already included in the channel.",channel:null,user:null};
        if(userData.blockedContacts.includes(channelName)) return {err:"User "+invited+" include channel named "+channelName+" in block list.",channel:null,user:null};
        await channel.addMember(user);
        await user.addChannel(channel,{through:{enable:true}});
        await channel.reload();
        await user.reload();
        console.log('inviteUserToChannel channel: ',channel);
        return {err:null,channel:channel,user:user};
    } catch (err) {
        console.log('inviteUserToChannel err: ',err);
        return {err:err,channel:null,user:null};
    }
};
//joinToChannel
Channel.joinToChannel = async function(channelName,joined) {
    console.log('joinToChannel channelName: ',channelName, ', joined: ',joined);
    let Channel = this;
    let err = {};
    try {
        let user = await User.findOne({
            where:{username:joined},
            include: [
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ],
        });
        let channel = await Channel.findOne({
            where:{name:channelName},
            include:[
                {model: User,as:'members'},
            ]
        });
        let userData = await user.reformatData();
        let channelData = await channel.reformatData();
        console.log('joinToChannel userData: ',userData);
        console.log('joinToChannel channelData: ',channelData);

        if(channelData.members.includes(joined)) return {err:"User "+joined+" is already included in the channel.",channel:null,user:null};
        if(channelData.private) return {err:"The channel is private. Entry by invitation only.",channel:null,user:null};
        if(userData.blockedContacts.includes(channelName)) return {err:"You include channel named "+channelName+" in block list.",channel:null,user:null};
        await channel.addMember(user);
        await user.addChannel(channel,{through:{enable:true}});
        await channel.reload();
        await user.reload();
        console.log('joinToChannel channel: ',channel);
        return {err:null,channel:channel,user:user};
    } catch (err) {
        console.log('joinToChannel err: ',err);
        return {err:err,channel:null,user:null};
    }
};

Channel.leaveChannel = async function(channelName,invited) {
    let Channel = this;
    let err = {};
    try {
        let user = await User.findOne({
            where:{username:invited},
            include: [
                {model: User,as:'contacts'},
                {model: User,as:'blockedContacts'},
            ],
        });
        let channel = await Channel.findOne({
            where:{name:channelName},
            include:[
                {model: User,as:'members'},
            ]
        });
        let userData = await user.reformatData();
        let channelData = await channel.reformatData();
        console.log('inviteUserToRoom userData: ',userData);
        console.log('inviteUserToRoom channelData: ',channelData);
        if(!channelData.members.includes(invited)) return {err:"User "+invited+" is not included in the channel.",channel:null,user:null};
        await channel.removeMember(user);
        await user.removeChannel(channel);
        await channel.reload();
        await user.reload();
        return {err:null,channel:channel,user:user};
    } catch (err) {
        console.log('createChannel err: ',err);
        return {err:err,channel:null,user:null};
    }
};




module.exports.User = User;
module.exports.Message = Message;
module.exports.Room = Room;
module.exports.MessageData = MessageData;
module.exports.UserRoom = UserRoom;
module.exports.Channel = Channel;
module.exports.ChannelUser = ChannelUser;




