//third-party applications
import VisibilitySensor from 'react-visibility-sensor'
import React from 'react';
import Page from '../layout/page.js';
import io from 'socket.io-client';
import {Redirect} from 'react-router-dom'
////
import UserBtn from '../partials/userBtn.js'
import Modal from '../partials/modalWindow.js'
import Confirm from '../partials/confirmModalWindow.js'
import Prompt from '../partials/promptModalWindow.js'
import ItmProps from '../partials/itmProps.js'
import RoomProps from '../partials/roomPropsWindow.js'
import ChannelProps from '../partials/channelPropsWindow.js'
import UserProps from '../partials/userPropsWindow.js'
import searchImg from '../../public/img/magnifier.svg'
import addGroupImg from '../../public/img/add-group-of-people.png'
import addChannelImg from '../../public/img/speaker.png'
import addUserImg from '../../public/img/add-user-button.png'
import OnContextMenuBtn from '../partials/onContextMenuBtn.js'
import Map from '../partials/openStreetMap.js'
//sounds
import Sound from 'react-sound'
import soundFile from '../../public/sounds/swiftly-610.mp3'






let contentMenuStyle = {
    display: location ? 'block' : 'none',
    position: 'absolute',
    left: location ? location.x : 0,
    top: location ? location.y : 0
};






class Chat extends React.Component {

    constructor(props) {
        let user = JSON.parse(sessionStorage.getItem('user')).user;
        //console.log("/chat user: ",user);
        super(props);
        this.state = {
            modalWindow:false,
            modalWindowMessage:"",

            errorRedirect: false,
            loginRedirect:false,
            err:{},

            user: user,

            message: '',

            contacts: [],
            filteredContacts: [],
            foundContacts: [],
            blockedContacts: [],
            rooms: [],
            filteredRooms: [],
            foundRooms: [],
            channels:[],
            filteredChannels: [],
            foundChannels: [],
            searchInput:false,

            messagesStore: {
                contacts:{},
                rooms:{},
                channels:{}
            },
            searchMess: false,
            messSearchArr: [],
            textSearchMess: '',
            messageLink: '',

            arrayBlockHandlerId: undefined,
            messageBlockHandlerId: undefined,

            resAddMeHandler:false,
            resAddMeAddMeName:"",
            addMeHandler:false,
            joinToRoomHandler:false,
            joinToChannelHandler:false,
            reqAddMeName:"",

            changeStatusHandler:false,
            changeStatusName:"",
            changeStatusAct:"",

            confirmMessage:"",

            promptCreateRoom:false,
            promptSearchUser:false,
            promptCreateChannel:false,
            promptRes:"",
            showSearch: false,
            showHistorySearch:false,
            showMap:false,
            location:undefined,

            roomPropsWindow:false,
            channelPropsWindow:false,
            userPropsWindow:false,

            connectionLost:false,

            scrollTopMax: undefined,
            //Message list context menu states
            onContextMenuBtn:false,
            contextMenuLocation: contentMenuStyle,
            selectMode:false,
            isChecked: false,
            isForward: false,
            selectModMsgList:[],
            btnList: ['Find Message','Select Mod'],
            //sound
            playIncomingMes:false
            //['Find Message','Select Mod','Delete Selected','Clear Selected','Forward Selected','Copy Selected as Text'],
        };
    }
    componentDidUpdate(prevProps){
        //move scroll bootom
        //this.scrollToBottom(this.refs.InpUl);

    }

    componentDidMount(){
        // if ("geolocation" in navigator) {
        //     console.log("Available");
        // } else {
        //     console.log("Not Available");
        // }
        //console.log("CDM");
        //move scroll bootom
        //this.scrollToBottom(this.refs.InpUl);

        let socket = io.connect('', {reconnection: true});
        //receivers
        this.socket = socket
            //.emit('sayOnLine')

            .on('messageForward', (mesArray,itmType,itmName)=>{
                switch (itmType) {
                    case "users":
                        mesArray.forEach(itm => this.printMessage(itm,"contacts", itmName));
                        this.msgCounter("contacts",itmName);
                        break;
                    case "rooms":
                        mesArray.forEach(itm => this.printMessage(itm,"rooms", itmName));
                        this.msgCounter("rooms",itmName);
                        break;
                    case "channels":
                        mesArray.forEach(itm => this.printMessage(itm,"channels", itmName));
                        this.msgCounter("channels",itmName);
                        break;
                    default:
                        console.log("messageForward : Sorry, we are out of " + itmType + ".");
                }
            })

            .on('updateUserData',(userData)=>{
                //console.log("updateUserData: ",userData);
                if(userData.username !== this.state.user.username) return;
                //let sortUsers = userData.contacts.sort((a,b)=> b.onLine - a.onLine);
                //let sortBlockedUsers = userData.blockedContacts.sort((a,b)=> b.onLine - a.onLine);
                this.setState({
                    user:userData,
                    contacts:userData.contacts,
                    blockedContacts:userData.blockedContacts,
                    rooms:userData.rooms,
                    channels:userData.channels
                });
            })
            .on('updateMsgStatus',(itmType,itmName,idx,userName)=>{//userName for room || channel set status
                if(!itmType || !itmName || !idx) return;
                if(itmName === this.state.user.username) return;
                console.log("updateMsgData itmName: ",itmName," ,id: ",idx," ,itmType: ",itmType);
                let messagesStore = this.state.messagesStore;
                switch (itmType) {
                    case "users":
                        messagesStore["contacts"][itmName].find(itm => itm._id === idx).recipients.find(itm => itm.username === itmName).status = true;
                        break;
                    case "rooms":
                        messagesStore["rooms"][itmName].find(itm => itm._id === idx).recipients.find(itm => itm.username === userName).status = true;
                        break;
                    case "channels":
                        messagesStore["channels"][itmName].find(itm => itm._id === idx).recipients.find(itm => itm.username === userName).status = true;
                        break;
                    default:
                        console.log("updateMsgStatus : Sorry, we are out of " + itmType + ".");
                }
                this.setState({messagesStore});
            })
            .on('updateMessageStore',(username,ids)=> {//only for contacts, deleting messages from history
                console.log("updateMessageStore username: ", username, " ,mes ids: ", ids);
                if(!this.state.messagesStore["contacts"][username]) return;
                this.setState(state => {
                    state.messagesStore["contacts"][username] = state.messagesStore["contacts"][username].filter((itm) => !ids.includes(itm._id));
                    return state
                });

            })
            .on('onLine', (name)=> {
                //console.log('receiver user offLine: ',name," ,this.getUsersIdx: ", this.getUsersIdx("contacts",name));
                let contacts = this.state.contacts;
                let contactsBC = this.state.blockedContacts;
                if(this.getUsersIdx("contacts",name) !== -1) {
                    contacts[this.getUsersIdx("contacts",name)].onLine = true;
                    //let sortUsers = contacts.sort((a,b)=> b.onLine - a.onLine);
                    this.setState({contacts:contacts});
                }
                if(this.getUsersIdx("blockedContacts",name) !== -1) {
                    contactsBC[this.getUsersIdx("blockedContacts",name)].onLine = true;
                    //let sortUsers = contactsBC.sort((a,b)=> b.onLine - a.onLine);
                    this.setState({blockedContacts:contactsBC});
                }
            })
            .on('offLine', (name)=> {
                //console.log('receiver user offLine: ',name," ,this.getUsersIdx: ", this.getUsersIdx("contacts",name));
                let contacts = this.state.contacts;
                let contactsBC = this.state.blockedContacts;
                if(this.getUsersIdx("contacts",name) !== -1) {
                    contacts[this.getUsersIdx("contacts",name)].onLine = false;
                    //let sortUsers = contacts.sort((a,b)=> b.onLine - a.onLine);
                    this.setState({contacts:contacts});
                }
                if(this.getUsersIdx("blockedContacts",name) !== -1) {
                    contactsBC[this.getUsersIdx("blockedContacts",name)].onLine = false;
                    //let sortUsers = contactsBC.sort((a,b)=> b.onLine - a.onLine);
                    this.setState({blockedContacts:contactsBC});
                }
            })
            .on('message', (data)=> {
                //message receiver
                console.log('message receiver: ',data);
                this.printMessage(data,"contacts",data.author);
                this.msgCounter("contacts",data.author);
            })
            .on('messageRoom',(data)=>{
                //messageRoom receiver
                console.log('messageRoom receiver: ',data);
                this.printMessage(data,"rooms",data.sig);
                this.msgCounter("rooms",data.sig);
            })
            .on('messageChannel',(data)=>{
                //messageChannel receiver
                console.log('messageChannel receiver: ',data);
                this.printMessage(data,"channels",data.sig);
                this.msgCounter("channels",data.sig);
            })
            .on('typing', (username)=> {
                //receiver
                if(this.getUsersIdx("contacts",username) < 0) return;
                const typingUser = this.state.contacts[this.getUsersIdx("contacts",username)];
                typingUser.typing = true;
                this.setState({typingUser});
                setTimeout(()=>{
                    typingUser.typing = false;
                    this.setState({typingUser});
                },2000)
            })

            .on('disconnect', ()=>{
                //console.log("WSocket connection lost!");
                this.setState({connectionLost:true})
            })
            .on('connect', ()=>{
                //console.log("WSocket connection restored!");
                this.setState({connectionLost:false});
                this.socket.emit('sayOnLine');
            })
            .on('error',(message)=>{
                //console.log('Server error happened: ',message);
                if(typeof message === 'string' || message instanceof String) {
                    let data = JSON.parse(message);
                    if(data.status == 423 || data.status == 401) {
                        this.setState({err: data});
                        sessionStorage.setItem('error', message);
                        //console.log('error page redirect: ',this.state.err);
                        this.setState({errorRedirect: true});
                    }
                    this.setState({
                        err: {message:data.message,status:data.status},
                        modalWindow: true
                    });
                } else {
                    this.setState({
                        err: message,
                        modalWindow: true
                    });
                }
            })
            .on('logout',()=>{
                //console.log('logout');
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('error');
                this.setState({loginRedirect:true})
            });
    }
    //send .disconnect() then user logOut
    componentWillUnmount(){
        this.socket.disconnect();
    };

    scrollToBottom = (element) => {
        //console.log("this.state.scrollTopMax: ",this.state.scrollTopMax, " ,element.scrollHeight: ",element.scrollHeight);
        if(!element) return;
        element.scrollTop = element.scrollTopMax - this.state.scrollTopMax || element.scrollHeight;
    };

    //req subscribers log
    getLog =(a,e,reqMesCountCb)=>{
        if(this.state.arrayBlockHandlerId === a && this.state.messageBlockHandlerId === this.getUsersIdx(a,e) && reqMesCountCb === null) return;
        let messagesStore = this.state.messagesStore;
        if(!messagesStore[a][e]) messagesStore[a][e] = [];
        if(messagesStore[a][e].length >= 15 && reqMesCountCb === null) return;
        if(!reqMesCountCb) reqMesCountCb = 15;
        //console.log("getLog a,e: ",a,e);
        if(messagesStore[a][e].length === this.state[a][this.getUsersIdx(a,e)].allMesCounter) return;
        //console.log("getLog: ",a," ,",e," ,",reqMesCountCb);
        this.socket.emit(a === "rooms" ? 'getRoomLog' : a === "channels" ? 'getChannelLog' : 'getUserLog',e,reqMesCountCb,null,(err,arr)=>{
            //console.log("getUserLog arr: ",arr," ,err: ",err);
            if(err) {
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                })
            }else {
                messagesStore[a][e] = arr;
                this.setState({messagesStore},()=>this.scrollToBottom(this.refs.InpUl));
            }
        });
    };
    //filter subscribers then user type in search field
    filterSearch =(str)=> {
        return characters => characters.name.substring(0,str.length).toLowerCase() === str.toLowerCase();
    };
    //filter subscribers then user type in search field or send req for search in DB
    setFiltered = (nameStr) => {
        //console.log("setFiltered str: ",nameStr);
        if(nameStr.length === 0) {
            //this.setState({filteredContacts: [],foundContacts: []});
            this.setState({searchInput:false});
        } else {
            this.setState({
                searchInput:true,
                filteredContacts: this.state.contacts.filter(this.filterSearch(nameStr)),
                filteredRooms: this.state.rooms.filter(this.filterSearch(nameStr)),
                filteredChannels: this.state.channels.filter(this.filterSearch(nameStr)),
            }, ()=>{
                this.socket.emit('findContacts', nameStr,(err,contactsArr)=>{
                    console.log("setFiltered contactsArr: ",contactsArr);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({
                            foundContacts: contactsArr.users,
                            foundRooms: contactsArr.rooms,
                            foundChannels: contactsArr.channels,
                        });
                    }
                })
            });
        }
    };
    //typing msg receiver
    typing =(name,ev)=> {
        //console.log('this.typing sId: ', sId);
        this.setState({message: ev.target.value});
        if(name) {this.socket.emit('typing', name)}
    };
    //unread msgs counter
    msgCounter =(a,e,unreadFlag)=> {
        console.log("msgCounter a: ",a," ,e: ",e);
        let i = this.getUsersIdx(a,e);
        console.log("msgCounter i: ",i);
        let current = this.state[a][i];
        console.log("msgCounter current: ",current);
        let currentUserMes = this.state.messagesStore[a][e];
        if(!unreadFlag) current.allMesCounter = current.allMesCounter + 1;
        let unReadMes = currentUserMes.filter(itm => itm.author !== this.state.user.username &&
                            itm.recipients.some(itm => itm.username === this.state.user.username) &&
                            !itm.recipients.find(itm => itm.username === this.state.user.username).status).length;
        current.msgCounter = unReadMes;
        this.setState({current});
    };
    //set current subscriber
    inxHandler =(a,i)=> {
        console.log('inxHandler arrName: ',a,", arrName inx: ", i);
        this.setState({showMap:false},()=>this.setState({messageBlockHandlerId: i, arrayBlockHandlerId: a}));
    };
    //transform data in milliseconds to string
    dateToString =(dateMlS)=> {
        let currentdate = new Date(dateMlS);
        if(new Date().getDate() === currentdate.getDate()){
            return currentdate.getHours() + ":" + currentdate.getMinutes()
        } else {
            return currentdate.getHours() + ":" + currentdate.getMinutes() + "  " + currentdate.getDate() + "." + (currentdate.getMonth()+1) + "." + currentdate.getFullYear()// + ":"+ currentdate.getSeconds();
        }

    };
    //send msg handler
    sendMessage =(name)=> {
        let date = Date.now();

            switch (this.state.arrayBlockHandlerId) {
                case "contacts":
                    //console.log("sendMessage contacts");
                    this.socket.emit('message', this.state.message, name, date, (err, mes) => {//This name means User Name
                        if (err) {
                            //console.log("sendMessage contacts err: ", err);
                            this.setState({
                                modalWindow: true,
                                err: {message: err},
                            })
                        } else {
                            this.printMessage(mes, "contacts",name);
                            this.msgCounter("contacts", name);
                            this.setState({message: ''}, () => this.scrollToBottom(this.refs.InpUl));
                        }
                    });
                    break;
                case "rooms":
                    //console.log("sendMessage rooms name: ", name);
                    this.socket.emit('messageRoom', this.state.message, name, date, (err, mes) => {//This name means Group Name
                        if (err) {
                            //console.log("sendMessage room err: ", err);
                            this.setState({
                                modalWindow: true,
                                err: {message: err},
                            })
                        } else {
                            //console.log("sendMessage room: ", mes);
                            this.printMessage(mes, "rooms", name);
                            this.msgCounter("rooms",  name);
                            this.setState({message: ''}, () => this.scrollToBottom(this.refs.InpUl));
                        }
                    });
                    break;
                case "channels":
                    //console.log("sendMessage channels name: ", name);
                    this.socket.emit('messageChannel', this.state.message, name, date, (err, mes) => {//This name means Channel Name
                        if (err) {
                            //console.log("sendMessage channel err: ", err);
                            this.setState({
                                modalWindow: true,
                                err: {message: err},
                            })
                        } else {
                            //console.log("sendMessage channel: ", mes);
                            this.printMessage(mes, "channels", name);
                            this.msgCounter("channels",  name);
                            this.setState({message: ''}, () => this.scrollToBottom(this.refs.InpUl));
                        }
                    });
                    break;
                default:
                    console.log("sendMessage: Sorry, we are out of " + res + ".");
            }

    };
    //
    getUsersIdx =(a,e)=> {
        return this.state[a].map( itm => itm.name).indexOf(e);
    };
    //pushing incoming msgs
    printMessage =(data,itmType,itmName)=> {
        let messagesStore = this.state.messagesStore;
        if(!messagesStore[itmType][itmName]) messagesStore[itmType][itmName] = [];
        messagesStore[itmType][itmName].push(data);
        this.setState({messagesStore});
        switch (itmType) {
            case "rooms":
            case "channels":
                if(!this.state[itmType][this.getUsersIdx(itmType,itmName)].members.find(itm => itm.username === this.state.user.username).enable) return ;
                console.log("play incoming rooms or channels mes sound enable")
                this.setState({playIncomingMes:true});
                break;
            case "contacts":
                console.log("play incoming contacts mes sound enable")
                this.setState({playIncomingMes:true});
                break;
            default:
                console.log("play incoming mes sound Sorry, we are out of " + itmType + ".");

        }
    };

    //User functional//
    moveToBlackList =(name)=> {
        this.socket.emit('moveToBlackList',name,(err,userData)=>{
            //console.log("moveToBlackList callback err: ",err," ,userData: ",userData);
            if(err) {
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                    addMeHandler: false,
                    confirmMessage:"",
                    reqAddMeName:"",
                })
            } else {
                this.setState({
                    contacts:userData.contacts,
                    blockedContacts:userData.blockedContacts,
                })
            }
        })
    };

    deleteUser =(name)=> {
        this.socket.emit('deleteUser',name,(err,userData)=>{
            //console.log("deleteUser callback err: ",err," ,userData: ",userData);
            if(err) {
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                    addMeHandler: false,
                    confirmMessage:"",
                    reqAddMeName:"",
                })
            } else {
                this.setState({
                    contacts:userData.contacts,
                    blockedContacts:userData.blockedContacts,
                })
            }
        })
    };

    searchUser = (data)=> {
        //console.log("searchUser: ",data);
        this.socket.emit('checkContact',data,(name)=>{
            if(name) {
                this.addMe(name)
            } else {
                this.setState({
                    modalWindow:true,
                    modalWindowMessage:"User with name or id: "+data+" not found.",
                })
            }
        })
    };

    historySearch = (text,name)=> {
        console.log("historySearch: ",text," ,userName: ",name);
        if(!name /*|| !text */|| !this.state.arrayBlockHandlerId) return;
        this.socket.emit('findMessage',this.state.arrayBlockHandlerId === "rooms" ? name : [name,this.state.user.username],text,(err,messages)=>{
            if(err) {
                //console.log("historySearch err: ",err);
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                })
            }else{
                //console.log("historySearch mesArr: ",messages, 'text.length:', text.length);
                this.setState({
                    showHistorySearch: true,
                    messSearchArr: [...messages],
                    textSearchMess: text
                })
            }
        })
    };

    changeScrollPos =(mesId)=> {
        const element = this.refs["InpUl"];
        const elemToScroll = this.refs[mesId];
        if(elemToScroll === undefined) {
            let messagesStore = this.state.messagesStore;
            let itmName = this.state[this.state.arrayBlockHandlerId][this.state.messageBlockHandlerId].name
            let a = this.state.arrayBlockHandlerId;
            this.socket.emit(a === "rooms" ? 'getRoomLog' : a === "channels" ? 'getChannelLog' : 'getUserLog',itmName,null,mesId,(err,arr)=>{
                console.log("getUserLog arr: ",arr," ,err: ",err);
                if(err) {
                    this.setState({
                        modalWindow:true,
                        err:{message:err},
                    })
                }else {
                    messagesStore[a][itmName] = arr;
                    this.setState({messagesStore}, ()=> this.changeScrollPos(mesId))
                }
            });
        }else {
            //console.log("changeScrollPos mesId: ",mesId, " ,this.refs.InpUl: ",element, " ,this.refs.mesId: ",elemToScroll);
            element.scrollTo(0, elemToScroll.offsetTop - 350)//.scrollTo(0, ref.current.offsetTop)
            this.setState({messageLink: mesId})
        }

    };

    addMe =(name,itmName)=> {
        //console.log("addMe: ",name);
        this.setState({
            addMeHandler: itmName === "user",
            joinToRoomHandler:itmName === "room",
            joinToChannelHandler:itmName === "channel",
            reqAddMeName:name,
            confirmMessage:"Send request to "+itmName+" name "+name+"?"
        })
    };

    resAddMe =(name)=>{
        //console.log("resAddMe: ",name);
        this.setState({
            resAddMeHandler:true,
            resAddMeAddMeName:name,
            confirmMessage:"Allow user "+name+" to add you?"
        })
    };

    addMeHandler = (confirmRes) => {
        //console.log('confirmRes: ',confirmRes);
        if(confirmRes){
            this.socket.emit('addMe', {name:this.state.reqAddMeName,date:Date.now()},(err,userData,msgData)=>{
                //console.log("addMe callback err: ",err," ,userData: ",userData);
                if(err) {
                    this.setState({
                        modalWindow:true,
                        err:{message:err},
                        addMeHandler: false,
                        confirmMessage:"",
                        reqAddMeName:"",
                        foundContacts:[]
                    })
                }else {
                    this.setState({
                        contacts:userData.contacts,
                        addMeHandler: false,
                        confirmMessage:"",
                        reqAddMeName:"",
                        foundContacts:[]
                    },()=>this.printMessage(msgData,"contacts",this.state.reqAddMeName));
                }
                this.refs["nameSearchInp"].value = "";
            })
        }else{
            this.setState({
                addMeHandler: false,
                confirmMessage:"",
                reqAddMeName:"",
            });
        }
    };

    resAddMeHandler =(confirmRes)=> {
        //('resAddMeHandler: ',confirmRes);
        if(confirmRes){
            let date = Date.now();
            let addUserName = this.state.resAddMeAddMeName;
            this.socket.emit('unBanUser', {name:addUserName,date:date},(err,userData,msgData)=>{
                //console.log("unBanUser callback err: ",err," ,userData: ",userData);
                if(err) {
                    this.setState({
                        modalWindow:true,
                        err:{message:err},
                        resAddMeHandler:false,
                        resAddMeAddMeName:"",
                        confirmMessage:""
                    })
                }else {
                    this.setState({
                        contacts:userData.contacts,
                        blockedContacts:userData.blockedContacts,
                        resAddMeHandler:false,
                        resAddMeAddMeName:"",
                        confirmMessage:""
                    });
                    this.printMessage(msgData,"contacts",addUserName);
                }
            })
        }else{
            this.setState({
                resAddMeHandler:false,
                resAddMeAddMeName:"",
                confirmMessage:""
            });
        }
    };

    userStatusHandler =(confirmRes)=> {
        //console.log('userStatusHandler: ',confirmRes,' ,this.state.changeStatusAct: ',this.state.changeStatusAct,', this.state.changeStatusName: ',this.state.changeStatusName);
        if(confirmRes){
            this.socket.emit(this.state.changeStatusAct, {name:this.state.changeStatusName,date:Date.now()},(err,userData,msgData)=>{
                //console.log("userStatusHandler callback err: ",err," , userData: ",userData," ,msgData: ",msgData);
                if(err) {
                    this.setState({
                        modalWindow:true,
                        err:{message:err},
                        changeStatusHandler:false,
                        changeStatusName:"",
                        changeStatusAct:"",
                        confirmMessage:""
                    })
                }else {
                    if(msgData) this.printMessage(msgData,"contacts",this.state.changeStatusName);
                    this.setState({
                        contacts:userData.contacts,
                        blockedContacts:userData.blockedContacts,
                        changeStatusHandler:false,
                        changeStatusName:"",
                        changeStatusAct:"",
                        confirmMessage:""
                    });
                }
            })
        }else{
            this.setState({
                changeStatusHandler:false,
                changeStatusName:"",
                changeStatusAct:"",
                confirmMessage:""
            });
        }
    };
    //Right click handler
    onContextMenuHandler = async (res,username,roomName)=>{
        console.log("onContextMenuHandler res: ", res,' ,arrayBlockHandlerId: ',this.state.arrayBlockHandlerId);

        let date = Date.now();
        switch (res) {
            case "shareLocation":
                navigator.geolocation.getCurrentPosition((position)=> {
                    console.log("Latitude is :", position.coords.latitude);
                    console.log("Longitude is :", position.coords.longitude);
                    let data = {latitude:position.coords.latitude,longitude:position.coords.longitude};
                    let name = this.state.contacts[this.state.messageBlockHandlerId].name;//curent user in contacts
                    this.socket.emit('message', 'console: shareLocation '+JSON.stringify(data),name, date, (err, mes) => {
                        if (err) {
                            //console.log("sendMessage contacts err: ", err);
                            this.setState({
                                modalWindow: true,
                                err: {message: err},
                            })
                        } else {
                            this.printMessage(mes, "contacts",name);
                            this.msgCounter("contacts", name);
                            this.setState({message: ''}, () => this.scrollToBottom(this.refs.InpUl));
                        }
                    });
                });

                break;
            case "shareContact":
                console.log("onContextMenuHandler shareContact username: ",username);
                let name = this.state.contacts[this.state.messageBlockHandlerId].name;//curent user in contacts
                this.socket.emit('message', 'console: shareContact '+username,name, date, (err, mes) => {
                    if (err) {
                        //console.log("sendMessage contacts err: ", err);
                        this.setState({
                            modalWindow: true,
                            err: {message: err},
                        })
                    } else {
                        this.printMessage(mes, "contacts",name);
                        this.msgCounter("contacts", name);
                        this.setState({message: ''}, () => this.scrollToBottom(this.refs.InpUl));
                    }
                });
                break;
            case "inviteUser":
                if(this.state.arrayBlockHandlerId === 'rooms'){
                    console.log("onContextMenuHandler inviteUser roomName: ",roomName,", username: ",username);
                    this.socket.emit('inviteUserToRoom',roomName,username,date,(err,data,msgData)=>{
                        //console.log("inviteUserToRoom' cb err: ",err,", cb rooms: ",data);
                        if(err) {
                            this.setState({
                                modalWindow:true,
                                err:{message:err},
                            })
                        }else {
                            this.setState({rooms:data.rooms});
                            this.printMessage(msgData,"rooms",roomName);
                        }
                    });
                }
                if(this.state.arrayBlockHandlerId === 'channels'){
                    console.log("onContextMenuHandler inviteUser channelName: ",roomName,", username: ",username);
                    this.socket.emit('inviteUserToChannel',roomName,username,date,(err,data,msgData)=>{//in this case roomName -> channels
                        //console.log("inviteUserToRoom' cb err: ",err,", cb rooms: ",data);
                        if(err) {
                            this.setState({
                                modalWindow:true,
                                err:{message:err},
                            })
                        }else {
                            this.setState({channels:data.channels});
                            this.printMessage(msgData,"channels",roomName);
                        }
                    });
                }
                break;
            case "banRoomUser":
                console.log("onContextMenuHandler banRoomUser roomName: ",roomName,", username: ",username);
                this.socket.emit('blockRoomUser',roomName,username,date,(err,data,msgData)=>{
                    console.log("blockRoomUser' cb err: ",err,", cb rooms: ",data,", msgData: ",msgData);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({rooms:data.rooms});
                        this.printMessage(msgData,"rooms",roomName);
                    }
                });
                break;
            case "unBanRoomUser":
                console.log("onContextMenuHandler unBlockRoomUser roomName: ",roomName,", username: ",username);
                this.socket.emit('unBlockRoomUser',roomName,username,date,(err,data,msgData)=>{
                    console.log("unBlockRoomUser' cb err: ",err,", cb rooms: ",data,", msgData: ",msgData);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({rooms:data.rooms});
                        this.printMessage(msgData,"rooms",roomName);
                    }
                });
                break;
            case "setRoomAdmin":
                //console.log("onContextMenuHandler setRoomAdmin roomName: ",roomName,", username: ",username);
                this.socket.emit('setRoomAdmin',roomName,username,date,(err,data,msgData)=>{
                    //console.log("setRoomAdmin cb err: ",err,", cb rooms: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({rooms:data.rooms});
                        this.printMessage(msgData,"rooms",roomName);
                    }
                });
                break;
            case "viewRoomData":
                //console.log("onContextMenuHandler viewRoomData: ",roomName);
                this.getLog("rooms",roomName,null);
                this.setState({
                    messageBlockHandlerId:this.getUsersIdx("rooms",roomName),
                    arrayBlockHandlerId:"rooms",
                },()=>this.hideShow("roomPropsWindow"));
                break;
            case "leaveRoom":
                console.log("onContextMenuHandler leaveRoom roomName: ",roomName);
                this.socket.emit('leaveRoom',roomName,date,(err,data)=>{
                    //console.log("leaveRoom cb err: ",err,", cb rooms: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({rooms:data.rooms});
                    }
                });
                break;
            case "chgChNtfStatus":
                console.log("onContextMenuHandler chgChNtfStatus  channelName: ",roomName);//in is case roomName -> channelName
                this.socket.emit('chgChNtfStatus',roomName,(err,data)=>{
                    //console.log("leaveRoom cb err: ",err,", cb rooms: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else this.setState({channels:data.channels});
                });
                break;
            case "chgRNtfStatus":
                console.log("onContextMenuHandler chgRNtfStatus roomName: ",roomName);
                this.socket.emit('chgRNtfStatus',roomName,(err,data)=>{
                    //console.log("leaveRoom cb err: ",err,", cb rooms: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else this.setState({rooms:data.rooms});
                });
                break;
            case "chgUNtfStatus":
                console.log("onContextMenuHandler chgUNtfStatus userName: ",roomName);//in is case roomName -> userName
                this.socket.emit('chgUNtfStatus',roomName,(err,data)=>{
                    //console.log("chgUNtfStatus cb err: ",err,", cb contacts: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else this.setState({contacts:data.contacts});
                });
                break;
            case "moveRoomOnTop":
                //console.log("onContextMenuHandler moveRoomOnTop: ",roomName);
                break;
            case "clearRoomWindow":
                //console.log("onContextMenuHandler clearRoomWindow");
                break;
            case "deleteUser":
                //console.log("onContextMenuHandler deleteUser");
                this.setState({
                    changeStatusHandler:true,
                    confirmMessage:"Are you sure you want to delete a user "+username+"?",
                    changeStatusName:username,
                    changeStatusAct:"deleteUser",
                });
                break;
            case "banUser":
                //console.log("onContextMenuHandler banUser");
                this.setState({
                    changeStatusHandler:true,
                    confirmMessage:"Are you sure you want to ban a user "+username+"?",
                    changeStatusName:username,
                    changeStatusAct:"banUser",
                });
                break;
            case "unBanUser":
                //console.log("onContextMenuHandler unBanUser");
                this.socket.emit('unBanUser', {name:username,date:date},(err,userData,msgData)=>{
                    //console.log("unBanUser callback err: ",err," ,userData: ",userData);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                            changeStatusHandler:false,
                            changeStatusName:"",
                            changeStatusAct:"",
                            confirmMessage:""
                        })
                    }else {
                        this.printMessage(msgData,"contacts",username);
                        this.setState({
                            contacts:userData.contacts,
                            blockedContacts:userData.blockedContacts,
                        });
                    }
                });
                break;
            case "clearChatWindow":
                //console.log("onContextMenuHandler clearChatWindow");
                break;
            case "viewUserData":
                //console.log("onContextMenuHandler viewUserData: ",username);
                if(this.getUsersIdx("contacts",username) >= 0) {
                    this.getLog("contacts",username,null);
                    return this.setState({
                        messageBlockHandlerId:this.getUsersIdx("contacts",username),
                        arrayBlockHandlerId:"contacts"
                    },()=>this.hideShow("userPropsWindow"));
                }
                if(this.getUsersIdx("blockedContacts",username) >= 0) {
                    this.getLog("blockedContacts",username,null);
                    return this.setState({
                        messageBlockHandlerId:this.getUsersIdx("blockedContacts",username),
                        arrayBlockHandlerId:"blockedContacts"
                    },()=>this.hideShow("userPropsWindow"));
                }
                break;
            case "moveOnTop":
                console.log("onContextMenuHandler moveOnTop");
                break;
            case "reqAuth":
                //console.log("onContextMenuHandler reqAuth");
                this.setState({reqAddMeName:username},()=>this.addMeHandler(true));
                break;
            case "leaveChannel":
                console.log("onContextMenuHandler leaveChannel channelName: ",roomName);
                this.socket.emit('leaveChannel',roomName,date,(err,data)=>{//in is case roomName -> channelName
                    console.log("leaveChannel cb err: ",err,", cb channel: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({channels:data.channels});
                    }
                });
                break;
            default:
                console.log("onContextMenuHandler Sorry, we are out of " + res + ".");
        }
    };
    //Group functional//
    createRoom =(roomName)=>{
        //console.log("createRoom: ",roomName);
        this.socket.emit('createRoom',roomName,Date.now(),(err,userData)=>{
            //console.log("createRoom res err: ",err," ,userData: ",userData);
            if(err){
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                })
            }else {
                this.setState({
                    rooms:userData.rooms,
                    modalWindow:true,
                    modalWindowMessage:"Group created successful.",
                })
            }
        })
    };
    //join to room
    joinToRoomHandler =(confirmRes)=>{
        if(confirmRes){
            console.log("joinToRoom rN: ",this.state.reqAddMeName);
            this.socket.emit('joinToRoom',this.state.reqAddMeName,Date.now(),(err,userData)=>{
                console.log("joinToRoom res err: ",err," ,userData: ",userData);
                if(err){
                    this.setState({
                        modalWindow:true,
                        err:{message:err},
                        joinToRoomHandler: false,
                        confirmMessage:"",
                        reqAddMeName:"",
                        foundRooms:[],
                        searchInput:false
                    })
                }else {
                    this.setState({
                        rooms:userData.rooms,
                        joinToRoomHandler: false,
                        confirmMessage:"",
                        reqAddMeName:"",
                        foundRooms:[],
                        searchInput:false
                    })
                }
                this.refs["nameSearchInp"].value = "";
            })
        }else{
            this.setState({
                joinToRoomHandler: false,
                confirmMessage:"",
                reqAddMeName:"",
                searchInput:false
            });
        }
    };
    //Channel functional
    //create Channel
    createChannel =(channelName)=>{
        //console.log("createRoom: ",roomName);
        this.socket.emit('createChannel',channelName,Date.now(),(err,userData)=>{
            //console.log("createChannel res err: ",err," ,userData: ",userData);
            if(err){
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                })
            }else {
                this.setState({
                    channels:userData.channels,
                    modalWindow:true,
                    modalWindowMessage:"Channel created successful.",
                })
            }
        })
    };
    //join to channel
    joinToChannelHandler =(confirmRes)=>{
        if(confirmRes){
            console.log("joinToChannel chN: ",this.state.reqAddMeName);
            this.socket.emit('joinToChannel',this.state.reqAddMeName,Date.now(),(err,userData)=>{
                console.log("joinToChannel res err: ",err," ,userData: ",userData);
                if(err){
                    this.setState({
                        modalWindow:true,
                        err:{message:err},
                        joinToChannelHandler: false,
                        confirmMessage:"",
                        reqAddMeName:"",
                        foundChannels:[],
                        searchInput:false
                    })
                }else {
                    this.setState({
                        rooms:userData.rooms,
                        joinToChannelHandler: false,
                        confirmMessage:"",
                        reqAddMeName:"",
                        foundChannels:[],
                        searchInput:false
                    })
                }
                this.refs["nameSearchInp"].value = "";
            })
        }else{
            this.setState({
                joinToChannelHandler: false,
                confirmMessage:"",
                reqAddMeName:"",
                searchInput:false
            });
        }
    };
    //Triggers
    hideModal =()=> {
        this.setState({modalWindow: false,modalWindowMessage:"",err:{}});
    };

    hideShow = (name) => {
        console.log('hideShow name: ',name);
        this.setState({
            [name]: !this.state[name],
            searchMess: false,
            messageLink:''
        });
    };

    toggleSearch = ()=>{
        this.setState({showSearch: !this.state.showSearch})
    };
    //scrollHandler emit load new part of history log
    onScrollHandler =(e,name,array,itm)=> {
        //console.log("scrollHandler: ",e.target);
        if(e.target.scrollTop === 0) {
            //console.log("scrollHandler on top: ",e," ,",name," ,",array," ,",itm);
            let msgCount = this.state.messagesStore[array][name].length;
            this.setState({scrollTopMax: e.target.scrollTopMax},()=>this.getLog(array,name,msgCount+10));
        }
    };

    setAsRead = (itmName,idx)=>{
        console.log("setAsRead itmName: ",itmName," ,idx: ",idx);
        let a = this.state.arrayBlockHandlerId
        this.socket.emit('setMesStatus',idx,a,itmName,(err)=>{
            if(err) {
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                })
            } else {
                let messagesStore = this.state.messagesStore;
                messagesStore[a][itmName].find(itm => itm._id === idx).recipients.find(itm => itm.username === this.state.user.username).status = true;
                this.setState({messagesStore},()=> {
                    //console.log("setAsRead DONE!");
                    this.msgCounter(this.state.arrayBlockHandlerId,itmName,true)})
            }
        })
    };
    //chat list contextMenu
    rightClickMenuOn =(e)=> {
        //console.log("rightClickMenuOn itm: ",itm);
        //console.log("rightClickMenuOn e.pageX: ",e.pageX," ,e.pageY: ",e.pageY);
        this.setState({
            onContextMenuBtn:this.state.arrayBlockHandlerId !== undefined,
            contextMenuLocation: {left: e.pageX, top:e.pageY},
            btnList: this.state.selectModMsgList.length === 0 ? ['Find Message','Select Mode'] : ['Find Message','Select Mode','Delete Selected','Clear Selected','Forward Selected','Copy Selected as Text'],
        })
    };

    checkboxMsg =(id)=> {
        //console.log('checkboxMsg msgId: ',id);
        if(this.state.selectModMsgList.includes(id)){
            let msgList = this.state.selectModMsgList;
            let idx = msgList.indexOf(id);
            msgList.splice(idx, 1);
            this.setState({selectModMsgList: msgList});
            if(msgList.length === 0)  this.setState({selectMode:false,isChecked: false});

        } else this.setState({
            selectModMsgList: [...this.state.selectModMsgList, id],
            isChecked: true
        })
    };

    rightClickMenuOnHide =()=> {
        //console.log("rightClickMenuOnHide");
        this.setState({
            onContextMenuBtn: false,
            contextMenuLocation: contentMenuStyle
        });
    };

    onContextMenuBtnResponse =(res)=> {
        //console.log("onContextMenuBtnResponse res: ",res);
        let currentUser = this.state.contacts[this.state.messageBlockHandlerId].name;

        switch (res){
            case "Find Message":
                //console.log("onContextMenuBtnResponse Find Message");
                this.setState({
                    showHistorySearch:!this.state.showHistorySearch,
                    onContextMenuBtn: false,
                });
                break;
            case "Delete Selected":
                //console.log("onContextMenuBtnResponse Delete Message: currentUser: ",currentUser,',','selectModMsgList: ',this.state.selectModMsgList);
                this.socket.emit('deleteMessages',currentUser,this.state.selectModMsgList, (err)=>{
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        let messagesStore = this.state.messagesStore;
                        //console.log("msgStore: ", messagesStore[currentUser]," ,len: ", messagesStore[currentUser].length);
                        this.setState(state => {
                            state.messagesStore["contacts"][currentUser] = state.messagesStore["contacts"][currentUser].filter((itm) => !this.state.selectModMsgList.includes(itm._id));
                            return state
                        });
                        this.setState({
                            selectMode:false,
                            onContextMenuBtn: false,
                            selectModMsgList: [],
                            isChecked: false
                        });
                    }
                });
                break;
            case "Select Mode":
                //console.log("onContextMenuBtnResponse Select Mode");
                this.setState({
                    selectMode:!this.state.selectMode,
                    onContextMenuBtn: false,
                    selectModMsgList: []
                });
                break;
            case "Forward to":
                //console.log("onContextMenuBtnResponse Forward Message: currentUser: ", currentUser);
                this.setState({
                    isForward: !this.state.isForward
                });
                break;
            default:
                console.log("onContextMenuBtnResponse Sorry, we are out of " + res + ".");
        }
    };

    forwardHandler =(forwardTo,forwardFrom,arrayFrowardTo)=>{
        let arrayFrowardFrom = this.state.arrayBlockHandlerId;
        console.log("forwardHandler forwardTo: ",forwardTo,", forwardFrom: ",forwardFrom,", arrayFrowardTo: ",arrayFrowardTo,", arrayFrowardFrom: ",arrayFrowardFrom);
        this.socket.emit('messageForward', this.state.selectModMsgList, forwardTo,forwardFrom,arrayFrowardTo,arrayFrowardFrom, (err, mesArray) => {//
            if (err) {
                console.log("messageForward: ", err);
                this.setState({
                    modalWindow: true,
                    err: {message: err},
                })
            } else {
                console.log("messageForward successful updatedMes: ", mesArray);
                mesArray.forEach(itm => this.printMessage(itm, arrayFrowardTo,forwardTo));
                this.setState({
                    isForward: false,
                    selectMode:false,
                    isChecked: false,
                    selectModMsgList:[],
                });
            }
        });
    };

    locationParse =(string)=> {
        //latitude: 50.0094293, longitude: 36.254585
        let data = string.split(',');
        let loc = data.map(itm => +itm.split(':')[1]);
        console.log('locationParse: ',loc);
        this.setState({location:loc},()=> this.setState({showMap:true}));
    };

    handleSongFinishedPlaying =(soundName)=>{
        console.log('handleSongFinishedPlaying soundName: ',soundName);
        switch (soundName){
            case 'playIncomingMes':
                this.setState({playIncomingMes:false})
                break;
            default:
                console.log("handleSongFinishedPlaying Sorry, we are out of soundName:" + soundName + ".");
        }
    }

    render() {
        console.log('/chat user:', this.state);
        if (this.state.errorRedirect) {
            return <Redirect to='/error'/>
        }//passing props in Redirect to={{pathname:'/error',state:{error:this.state.err}}} get props: this.props.location.state.error
        if (this.state.loginRedirect) {
            return <Redirect to='/login'/>
        }
        const test = this.refs["InpUl"];
        const elements = this.state.messSearchArr.map((message)=>{
            const{text, user, date, status} = message;
            return(
                <li key={message._id} className={`message-search-item ${message._id === this.state.messageLink ? 'active' :''}`} onClick={() => this.changeScrollPos(message._id)}>
                    <div className='message-search-title'>
                        <p className='user'>{user}</p>
                        <div className='message-search-data'>
                            <p className={`message-status ${status ? 'read': 'unread'}`}/>
                            <p className="messageTime">{this.dateToString(date)}</p>
                        </div>
                    </div>
                    <p className='message-search-text'>{text}</p>
                </li>
            )
        });
        const contacts = this.state.contacts.length !== 0 ? <div>
                <div className="userList white">white list contacts</div>
                {
                    this.state.contacts.map((itm, i) =>
                        <UserBtn
                            key={i}
                            itm={itm}
                            i={i}
                            contacts={this.state.contacts.map(itm => itm.name).filter(name => name !== itm.name)}
                            userNRSStatus={itm.enable}
                            getUserLog={() => this.getLog("contacts", itm.name, null)}
                            inxHandler={() => this.inxHandler("contacts", i)}
                            messageBlockHandlerId={this.state.messageBlockHandlerId}
                            onContextMenuHandler={this.onContextMenuHandler}
                            banList={false}
                            roomList={false}
                        />)
                }
            </div> : "";
        const filteredContacts = this.state.filteredContacts.map((itm, i) => <UserBtn
                                key={i}
                                itm={itm}
                                contacts={this.state.contacts.map(itm => itm.name).filter(name => name !== itm.name)}
                                userNRSStatus={itm.enable}
                                i={this.getUsersIdx("contacts", itm.name)}
                                getUserLog={() => this.getLog("contacts", itm.name, null)}
                                inxHandler={() => this.inxHandler("contacts", i)}
                                messageBlockHandlerId={this.state.messageBlockHandlerId}
                                onContextMenuHandler={this.onContextMenuHandler}
                                banList={false}
                                roomList={false}
                            />);
        const foundContacts = this.state.foundContacts.length !== 0 ?this.state.foundContacts.map((name, i) => <UserBtn
                key={i}
                i={i}
                name={name}
                addMe={() => this.addMe(name,"user")}
                roomList={false}
                channelList={false}
            />
        ):"";


        const blockedUsers = this.state.blockedContacts.length !== 0 ? <div>
                <div className="userList black">black list contacts</div>
                {
                    this.state.blockedContacts.map((itm, i) =>
                        <UserBtn
                            key={i}
                            itm={itm}
                            i={i}
                            getUserLog={() => this.getLog("blockedContacts", itm.name, null)}
                            inxHandler={() => this.inxHandler("blockedContacts", i)}
                            messageBlockHandlerId={this.state.messageBlockHandlerId}
                            onContextMenuHandler={this.onContextMenuHandler}
                            banList={true}
                            roomList={false}
                        />)
                }
            </div>
            : "";
        const rooms = this.state.rooms.length !== 0 ? <div>
                <div className="userList white">group list</div>
                {
                    this.state.rooms.map((itm, i) =>
                        <UserBtn
                            key={i}
                            name={itm.name}
                            itm={itm}
                            i={i}
                            getUserLog={() => this.getLog("rooms", itm.name, null)}
                            inxHandler={() => this.inxHandler("rooms", i)}
                            messageBlockHandlerId={this.state.messageBlockHandlerId}
                            onContextMenuHandler={this.onContextMenuHandler}
                            banList={false}
                            roomList={true}
                            userList={this.state.contacts.map(itm => itm.name)}
                            username={this.state.user.username}
                            userNRSStatus={itm.members.some(itm => itm.username === this.state.user.username) ? itm.members.find(itm => itm.username === this.state.user.username).enable : ""}//user Room notification status
                        />)
                }
            </div>
            : "";
        const filteredRooms = this.state.filteredRooms.map((itm, i) => <UserBtn
                            key={i}
                            name={itm.name}
                            itm={itm}
                            i={i}
                            getUserLog={() => this.getLog("rooms", itm.name, null)}
                            inxHandler={() => this.inxHandler("rooms", i)}
                            messageBlockHandlerId={this.state.messageBlockHandlerId}
                            onContextMenuHandler={this.onContextMenuHandler}
                            banList={false}
                            roomList={true}
                            userList={this.state.contacts.map(itm => itm.name)}
                            username={this.state.user.username}
                            userNRSStatus={itm.members.some(itm => itm.username === this.state.user.username) ? itm.members.find(itm => itm.username === this.state.user.username).enable : ""}//user Room notification status
                        />)
        const foundRooms = this.state.foundRooms.length !== 0 ? this.state.foundRooms.map((name, i) => <UserBtn
                key={i}
                i={i}
                name={name}
                addMe={() => this.addMe(name,"room")}
                roomList={true}
                channelList={false}
            />
        ):""


        const channels = this.state.channels.length !== 0 ?
            <div>
                <div className="userList white">channels list</div>
                {
                    this.state.channels.map((itm, i) =>
                        <UserBtn
                            key={i}
                            name={itm.name}
                            itm={itm}
                            i={i}
                            getUserLog={() => this.getLog("channels", itm.name, null)}
                            inxHandler={() => this.inxHandler("channels", i)}
                            messageBlockHandlerId={this.state.messageBlockHandlerId}
                            onContextMenuHandler={this.onContextMenuHandler}
                            banList={false}
                            channelList={true}
                            userList={this.state.contacts.map(itm => itm.name)}
                            username={this.state.user.username}
                            userNRSStatus={itm.members.some(itm => itm.username === this.state.user.username) ? itm.members.find(itm => itm.username === this.state.user.username).enable : ""}//user Room notification status
                        />)
                }
            </div>
            : "";
        const filteredChannels = this.state.filteredChannels.map((itm, i) =>
                        <UserBtn
                            key={i}
                            name={itm.name}
                            itm={itm}
                            i={i}
                            getUserLog={() => this.getLog("channels", itm.name, null)}
                            inxHandler={() => this.inxHandler("channels", i)}
                            messageBlockHandlerId={this.state.messageBlockHandlerId}
                            onContextMenuHandler={this.onContextMenuHandler}
                            banList={false}
                            channelList={true}
                            userList={this.state.contacts.map(itm => itm.name)}
                            username={this.state.user.username}
                            userNRSStatus={itm.members.some(itm => itm.username === this.state.user.username) ? itm.members.find(itm => itm.username === this.state.user.username).enable : ""}//user Room notification status
                        />)
        const foundChannels = this.state.foundChannels.length !== 0 ? this.state.foundChannels.map((name, i) => <UserBtn
                key={i}
                i={i}
                name={name}
                addMe={() => this.addMe(name,"channel")}
                roomList={false}
                channelList={true}
            />
        ):""

        return (
            <Page user={this.state.user} title="CHAT PAGE" className="container">
                {this.state.playIncomingMes ? <Sound
                    url={soundFile}
                    playStatus={Sound.status.PLAYING}//playStatus={Sound.status.PLAYING}//STOPPED,PAUSED
                    onFinishedPlaying={()=> this.handleSongFinishedPlaying('playIncomingMes')}
                    />
                    :""
                }
                {this.state.connectionLost ?
                    <Modal show={this.state.connectionLost} err={this.state.err}
                           message={"Connection lost! Wait until the connection is established."}/>
                    : ""}
                {this.state.modalWindow ?
                    <Modal show={this.state.modalWindow} handleClose={this.hideModal} err={this.state.err}
                           message={this.state.modalWindowMessage ? this.state.modalWindowMessage : ""}/>
                    : ""}
                {this.state.addMeHandler ?
                    <Confirm confirmHandler={this.addMeHandler} show={this.state.addMeHandler}
                             message={this.state.confirmMessage}/>
                    : ""}
                {this.state.joinToRoomHandler ?
                    <Confirm confirmHandler={this.joinToRoomHandler} show={this.state.joinToRoomHandler}
                             message={this.state.confirmMessage}/>
                    : ""}
                {this.state.joinToChannelHandler ?
                    <Confirm confirmHandler={this.joinToChannelHandler} show={this.state.joinToChannelHandler}
                             message={this.state.confirmMessage}/>
                    : ""}
                {this.state.resAddMeHandler ?
                    <Confirm confirmHandler={this.resAddMeHandler} show={this.state.resAddMeHandler}
                             message={this.state.confirmMessage}/>
                    : ""}
                {this.state.changeStatusHandler ?
                    <Confirm confirmHandler={this.userStatusHandler} show={this.state.changeStatusHandler}
                             message={this.state.confirmMessage}/>
                    : ""}
                {(this.state.promptCreateRoom) ? (
                    <Prompt
                        promptHandler={this.createRoom}
                        show={this.state.promptCreateRoom}
                        handleClose={()=>this.hideShow("promptCreateRoom")}
                        name={"Group name"}
                        type={""}
                        placeholder={"Group name"}
                        message={"Input the desired group name."}/>
                ) : ('')}
                {(this.state.promptCreateChannel) ? (
                    <Prompt
                        promptHandler={this.createChannel}
                        show={this.state.promptCreateChannel}
                        handleClose={()=>this.hideShow("promptCreateChannel")}
                        name={"Channel name"}
                        type={""}
                        placeholder={"Group name"}
                        message={"Input the desired channel name."}/>
                ) : ('')}
                {(this.state.promptSearchUser) ? (
                    <Prompt
                        promptHandler={this.searchUser}
                        show={this.state.promptSearchUser}
                        handleClose={()=>this.hideShow("promptSearchUser")}
                        name={"User name"}
                        type={""}
                        placeholder={"name/id"}
                        message={"Input user name or id."}/>
                ) : ('')}
                {(this.state.roomPropsWindow) ?
                    (<RoomProps
                        curentRoom={this.state.rooms[this.state.messageBlockHandlerId]}
                        handleClose={()=>this.hideShow("roomPropsWindow")}
                        show={this.state.roomPropsWindow}
                    />) : ("")}
                {(this.state.channelPropsWindow) ?
                    (<ChannelProps
                        curentChannel={this.state.channels[this.state.messageBlockHandlerId]}
                        handleClose={()=>this.hideShow("channelPropsWindow")}
                        show={this.state.channelPropsWindow}
                    />) : ("")}
                {(this.state.userPropsWindow) ?
                    (<UserProps
                        curentUser={this.state[this.state.arrayBlockHandlerId][this.state.messageBlockHandlerId]}
                        handleClose={()=>this.hideShow("userPropsWindow")}
                        show={this.state.userPropsWindow}
                    />) : ("")}
                {this.state.onContextMenuBtn ?
                    <OnContextMenuBtn
                        onContextMenuBtnsResponse={this.onContextMenuBtnResponse}
                        contextMenuLocation={this.state.contextMenuLocation}
                        rightClickMenuOnHide={this.rightClickMenuOnHide}
                        btnList={this.state.btnList}
                    />
                    :''}
                <div className="chat-room">
                    <div className="chat-contacts">
                        <div className="login-form">
                            <form className={`${this.state.showSearch ? "show" : ""}`}>
                                {this.state.showSearch ?
                                    <input name="nameSearchInp" ref="nameSearchInp"//this.refs.nameSearchInp.target.value
                                           className={`form-control searchInChat`}
                                           autoComplete="off" autoFocus placeholder="Search..."
                                           onChange={ev => this.setFiltered(ev.target.value)}
                                    />
                                    : ""}
                            </form>

                            {
                                !this.state.showMap ?
                                    <div className="userList btnList">
                                        <button onClick={() => this.toggleSearch()} name="msgBtn" type="button"
                                                className="btn search">
                                            <img src={searchImg} alt="search"/>
                                            <span className="tooltiptext">Search</span>
                                        </button>

                                        <button onClick={() => this.hideShow("promptCreateRoom")} name="msgBtn" type="button" className="btn">
                                            <img src={addGroupImg} alt="add user"/>
                                            <span className="tooltiptext">Create group</span>
                                        </button>

                                        <button onClick={() => this.hideShow("promptCreateChannel")} name="msgBtn" type="button" className="btn">
                                            <img src={addChannelImg} alt="add user"/>
                                            <span className="tooltiptext">Create channel</span>
                                        </button>

                                        <button onClick={() => this.hideShow("promptSearchUser")} name="msgBtn" type="button" className="btn">
                                            <img src={addUserImg} alt="add user"/>
                                            <span className="tooltiptext">Add user</span>
                                        </button>
                                    </div> : ""
                            }



                            {this.state.textSearchMess.length > 0 && this.state.showHistorySearch && this.state.messSearchArr.length >= 1 ?
                                <div className='message-block-search'>
                                    {
                                        this.state.messSearchArr.length <= 0 ?
                                            <p className='message-count'>No messages found</p>
                                            :
                                            <p className='message-count'>Found {this.state.messSearchArr.length} message{this.state.messSearchArr.length > 1 ? 's' :''} </p>
                                    }

                                    <ul className='message-search-list'>
                                        {elements}
                                    </ul>
                                </div>
                                :
                                <div className='chat-contacts-list'>
                                    {
                                        <div>
                                            {
                                                (() => {
                                                    //console.log('userList data filteredContacts: ',this.state.filteredContacts, ", foundContacts: ",this.state.foundContacts)
                                                    if(this.state.searchInput === false) {
                                                        //console.log('full List')
                                                        return (
                                                            <div>
                                                                {contacts}
                                                                {blockedUsers}
                                                                {rooms}
                                                                {channels}
                                                            </div>
                                                        )
                                                    }else {
                                                        //console.log('search List')
                                                        return (

                                                                <div>
                                                                    <div className="userList white">filtered results</div>
                                                                    {filteredContacts}
                                                                    {filteredRooms}
                                                                    {filteredChannels}
                                                                    <div className="userList white">search results</div>
                                                                    {foundContacts}
                                                                    {foundRooms}
                                                                    {foundChannels}
                                                                </div>
                                                        )
                                                    }
                                                })()
                                            }

                                        </div>
                                    }

                                </div>
                            }
                        </div>
                    </div>

                    {
                        ((a, e) => {
                            //console.log('message-block: e:',e,", a:",a);
                            let eUser = {};
                            let eStore = {};
                            if (a !== undefined && e !== undefined) {eUser = this.state[a][e]}
                            else eUser = undefined;
                            if(eUser !== undefined && eUser.name !== undefined) {eStore = this.state.messagesStore[a][eUser.name]}
                            else eStore = undefined;
                            //console.log("eStore: ",eStore);

                                return (
                                    <div className="message-block">
                                        {
                                            this.state.showMap === false ?
                                                <div name="chatRoom" id="chatDiv">
                                                    <div className={`btnMessageGroup ${this.state.isChecked ? "show" : ""}`}>
                                                        {this.state.arrayBlockHandlerId === "rooms" ? "" :
                                                            <button className="btn" data-loading-text="Deleting..."
                                                                    onClick={() => this.onContextMenuBtnResponse('Delete Selected')}>
                                                                Delete</button>
                                                        }
                                                        <button className="btn" data-loading-text="Forward to..."
                                                                onClick={() => this.onContextMenuBtnResponse('Forward to')}>
                                                            Forward to
                                                        </button>

                                                    </div>
                                                    <div className={`forwardUserList ${this.state.isForward ? "show" : ""}`}>
                                                        <ul>

                                                            <li className="userList white">USERS</li>
                                                            {this.state.contacts.map((user, i) => <li key={i}
                                                                                                   onClick={() => this.forwardHandler(user.name, eUser.name, 'contacts')}
                                                                                                   className="btn user">{user.name}</li>)}
                                                            <li className="userList white">GROUPS</li>
                                                            {this.state.rooms.map((room, i) => <li key={i}
                                                                                                   onClick={() => this.forwardHandler(room.name, eUser.name, 'rooms')}
                                                                                                   className="btn user">{room.name}</li>)}
                                                        </ul>
                                                    </div>
                                                    {a === "rooms" ?
                                                        <div onClick={() => this.hideShow("roomPropsWindow")}>
                                                            <ItmProps room={eUser}/>
                                                        </div> : a === "channels" ?
                                                        <div onClick={() => this.hideShow("channelPropsWindow")}>
                                                            <ItmProps channel={eUser}/>
                                                        </div> :
                                                            e !== undefined ?
                                                                <div onClick={() => this.hideShow("userPropsWindow")}>
                                                                    <ItmProps user={eUser}/>
                                                                </div> : ""}

                                                    {this.state.showHistorySearch ?
                                                        <div className='historySearchInpWrapper'>
                                                            <input name="historySearchInp" ref="historySearchInp"
                                                                   className={`form-control searchInChat ${this.state.showHistorySearch ? "show" : ""}`}
                                                                   autoComplete="off" autoFocus placeholder="Search..."
                                                                   onChange={ev => this.historySearch(ev.target.value, this.state.arrayBlockHandlerId === "rooms" ? eUser : eUser.name)}/>
                                                            <div className='modal-main-btnRight-center'
                                                                 onClick={() => this.hideShow("showHistorySearch")}>X
                                                            </div>

                                                        </div> : ""}


                                                    <ul onScroll={(evn) => this.onScrollHandler(evn, eUser.name, a, e)}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            this.rightClickMenuOn(e);
                                                            return false;
                                                        }}
                                                        name="InpUl" className="chat-list" ref="InpUl">
                                                        {
                                                            (eUser && eStore) ? (
                                                                eStore.map((data, i) => {
                                                                    return (
                                                                        (data.author === this.state.user.username && data.forwardFrom == null) ? (
                                                                            <li key={i}
                                                                                className={`right ${this.state.messageLink === data._id ? 'active' : ''}`}
                                                                                ref={data._id}> {data.text}
                                                                                <div className="messageData">
                                                                                    {this.state.selectMode ?
                                                                                        <label htmlFor={`${data._id}`}
                                                                                               className="label-cbx">
                                                                                            <input id={`${data._id}`}
                                                                                                   type="checkbox" name="msgCB"
                                                                                                   className="invisible"
                                                                                                   onChange={ev => (this.checkboxMsg(data._id))}
                                                                                            />
                                                                                            <div className="checkbox">
                                                                                                <svg width="10px" height="10px"
                                                                                                     viewBox="0 0 20 20">
                                                                                                    <path
                                                                                                        d="M3,1 L17,1 L17,1 C18.1045695,1 19,1.8954305 19,3 L19,17 L19,17 C19,18.1045695 18.1045695,19 17,19 L3,19 L3,19 C1.8954305,19 1,18.1045695 1,17 L1,3 L1,3 C1,1.8954305 1.8954305,1 3,1 Z"></path>
                                                                                                    <polyline
                                                                                                        points="4 11 8 15 16 6"></polyline>
                                                                                                </svg>
                                                                                            </div>
                                                                                        </label>
                                                                                        : ""
                                                                                    }
                                                                                    <div className='shortMessageInfo'>
                                                                                        {data.author}<span
                                                                                        className="messageTime">{this.dateToString(data.date)}</span>
                                                                                        <span className="messageTime">
                                                                               {
                                                                                   data.recipients.length === 1 ? data.recipients[0].status === true ? " R" : "" :
                                                                                       data.recipients.length === data.recipients.filter(itm => itm.status === true).length ? " R" :
                                                                                           data.recipients.map((itm, i) => itm.status === true ?
                                                                                               <span key={i}
                                                                                                     className="messageTime">{itm.username}</span> : "")
                                                                               }
                                                                            </span>
                                                                                        {data.forwardFrom == null ? "" : " Forwarded from: " + data.forwardFrom }
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                        ) : (
                                                                            <VisibilitySensor
                                                                                key={i + "VisibilitySensor"}
                                                                                containment={this.refs.InpUl}
                                                                                onChange={
                                                                                    (inView) => inView &&
                                                                                    data.recipients.some(itm => itm.username === this.state.user.username) &&
                                                                                    !data.recipients.find(itm => itm.username === this.state.user.username).status ? this.setAsRead(eUser.name, data._id) : ""
                                                                                }
                                                                            >
                                                                                <li className={`left ${this.state.messageLink === data._id ? 'active' : ''}`}
                                                                                    key={i} ref={data._id}
                                                                                    onClick={() => {
                                                                                        data.recipients.some(itm => itm.username === this.state.user.username) &&
                                                                                        !data.recipients.find(itm => itm.username === this.state.user.username).status ?
                                                                                            this.setAsRead(eUser.name, data._id) : ""
                                                                                    }}
                                                                                >
                                                                                    {data.text}
                                                                                    <div>
                                                                                        {
                                                                                            data.action && data.action === "shareContact" ? <button className="btnText" onClick={() => this.addMe(data.text)}>ADD</button> :
                                                                                                data.action && data.action === "shareLocation" ?
                                                                                                    <button className="btnText" onClick={() => this.locationParse(data.text)}>SHOW</button> : ""
                                                                                        }
                                                                                    </div>
                                                                                    <span className="messageData">
                                                                             {this.state.selectMode ?
                                                                                 <label htmlFor={`${data._id}`}
                                                                                        className="label-cbx">
                                                                                     <input id={`${data._id}`}
                                                                                            type="checkbox" name="msgCB"
                                                                                            className="invisible"
                                                                                            onChange={ev => (this.checkboxMsg(data._id))}
                                                                                     />
                                                                                     <div className="checkbox">
                                                                                         <svg width="10px" height="10px"
                                                                                              viewBox="0 0 20 20">
                                                                                             <path
                                                                                                 d="M3,1 L17,1 L17,1 C18.1045695,1 19,1.8954305 19,3 L19,17 L19,17 C19,18.1045695 18.1045695,19 17,19 L3,19 L3,19 C1.8954305,19 1,18.1045695 1,17 L1,3 L1,3 C1,1.8954305 1.8954305,1 3,1 Z"></path>
                                                                                             <polyline
                                                                                                 points="4 11 8 15 16 6"></polyline>
                                                                                         </svg>
                                                                                     </div>
                                                                                 </label>
                                                                                 : ""
                                                                             }
                                                                                        <div className='shortMessageInfo'>
                                                                                  {data.author}
                                                                                            <span
                                                                                                className="messageTime">{this.dateToString(data.date)}</span>
                                                                                            {
                                                                                                data.recipients.length === 1 ? data.recipients[0].status === true ? "" : " UR" :
                                                                                                    data.recipients.length === data.recipients.filter(itm => itm.status === true).length ? " R" :
                                                                                                        data.recipients.map((itm, i) => itm.status === true ?
                                                                                                            <span key={i}
                                                                                                                  className="messageTime">{itm.username}</span> : "")
                                                                                            }
                                                                                            {data.forwardFrom == null ? "" : " Forwarded from: " + data.forwardFrom }
                                                                            </div>
                                                                        </span>
                                                                                </li>
                                                                            </VisibilitySensor >

                                                                        )
                                                                    )
                                                                })
                                                            ) : ("")
                                                        }
                                                    </ul>
                                                    {
                                                        (this.state.arrayBlockHandlerId === "channels" &&
                                                            this.state.channels[this.state.messageBlockHandlerId].members.find(itm => itm.username === this.state.user.username).admin) ||
                                                        (this.state.arrayBlockHandlerId === "rooms") || (this.state.arrayBlockHandlerId === "contacts") ?
                                                            <form onSubmit={(ev) => {
                                                                ev.preventDefault();
                                                                //ev.stopPropagation();
                                                                this.sendMessage(eUser.name)
                                                            }} name="chatRoomForm" className="writeMessWrapp">
                                                                <div className="input-group writeMess">
                                                                    <input name="formInp" className="form-control writeChatMess"
                                                                        // autoComplete="off"
                                                                           autoFocus placeholder="Message..."
                                                                           value={this.state.message}
                                                                           onChange={ev => (this.typing(eUser.name, ev))}

                                                                    />
                                                                    {
                                                                        (a !== "blockedContacts") ?
                                                                            <button type='submit'
                                                                                    name="msgBtn" className="btn">
                                                                                SEND</button> :
                                                                            <button onClick={() => this.resAddMe(eUser.name)}
                                                                                    name="msgBtn"
                                                                                    type="button" className="btn">ALLOW USER</button>
                                                                    }
                                                                </div>
                                                            </form> : ""
                                                    }

                                                </div> :
                                                <Map
                                                    location={this.state.location}
                                                    handleClose={()=>this.hideShow("showMap")}
                                                />



                                        }
                                    </div>
                                );

                        })(this.state.arrayBlockHandlerId, this.state.messageBlockHandlerId)
                    }

                </div>
            </Page>
        );
    }
}

export default Chat;


