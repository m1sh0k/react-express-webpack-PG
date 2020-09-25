import React from 'react';
import Page from '../layout/page.js';
import io from 'socket.io-client';
import {Redirect} from 'react-router-dom'
import UserBtn from '../partials/userBtn.js'
import Modal from '../partials/modalWindow.js'
import Confirm from '../partials/confirmModalWindow.js'
import Prompt from '../partials/promptModalWindow.js'
import ItmProps from '../partials/itmProps.js'
import RoomProps from '../partials/roomPropsWindow.js'
import UserProps from '../partials/userPropsWindow.js'
import searchImg from '../../public/img/magnifier.svg'
import addGroupImg from '../../public/img/add-group-of-people.png'
import addUserImg from '../../public/img/add-user-button.png'
import OnContextMenuBtn from '../partials/onContextMenuBtn.js'

//third-party applications
import VisibilitySensor from 'react-visibility-sensor'


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

            users: [],
            filteredUsers: [],
            foundContacts: [],
            blockedContacts: [],
            rooms: [],
            messagesStore: {},
            searchMess: false,
            messSearchArr: [],
            textSearchMess: '',
            messageLink: '',

            arrayBlockHandlerId: undefined,
            messageBlockHandlerId: undefined,

            resAddMeHandler:false,
            resAddMeAddMeName:"",
            addMeHandler:false,
            reqAddMeName:"",

            changeStatusHandler:false,
            changeStatusName:"",
            changeStatusAct:"",

            confirmMessage:"",

            promptCreateRoom:false,
            promptSearchUser:false,
            promptRes:"",
            showSearch: false,
            showHistorySearch:false,

            roomPropsWindow:false,
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
            //['Find Message','Select Mod','Delete Selected','Clear Selected','Forward Selected','Copy Selected as Text'],
        };
    }
    componentDidUpdate(prevProps){
        //move scroll bootom
        //this.scrollToBottom(this.refs.InpUl);

    }

    componentDidMount(){
        //console.log("CDM");
        //move scroll bootom
        //this.scrollToBottom(this.refs.InpUl);

        let socket = io.connect('', {reconnection: true});
        //receivers
        this.socket = socket
            //.emit('sayOnLine')

            .on('messageForward', (mesArray,username)=>{
                mesArray.forEach(itm => this.printMessage(itm, username));
                this.msgCounter("users",this.getUsersIdx("users",username));
            })

            .on('updateUserData',(userData)=>{
                //console.log("updateUserData: ",userData);
                if(userData.username !== this.state.user.username) return;
                //let sortUsers = userData.contacts.sort((a,b)=> b.onLine - a.onLine);
                //let sortBlockedUsers = userData.blockedContacts.sort((a,b)=> b.onLine - a.onLine);
                this.setState({
                    user:userData,
                    users:userData.contacts,
                    blockedContacts:userData.blockedContacts,
                    rooms:userData.rooms,
                });
            })
            .on('updateMsgStatus',(itmName,idx,status)=>{
                console.log("updateMsgData itmName: ",itmName," ,id: ",idx," ,status: ",status);
                if(!itmName || !idx || !status) return;
                if(itmName === this.state.user.username) return;
                let messagesStore = this.state.messagesStore;
                if(!messagesStore[itmName]) return;
                messagesStore[itmName].find(itm => itm._id === idx).recipients.find(itm => itm.username === itmName).status = status;
                this.setState({messagesStore});
            })
            .on('updateMessageStore',(username,ids)=> {
                console.log("updateMessageStore username: ", username, " ,mes ids: ", ids);
                this.setState(state => {
                    state.messagesStore[username] = state.messagesStore[username].filter((itm) => !ids.includes(itm._id));
                    return state
                });

            })
            .on('onLine', (name)=> {
                //console.log('receiver user offLine: ',name," ,this.getUsersIdx: ", this.getUsersIdx("users",name));
                let users = this.state.users;
                let usersBC = this.state.blockedContacts;
                if(this.getUsersIdx("users",name) !== -1) {
                    users[this.getUsersIdx("users",name)].onLine = true;
                    //let sortUsers = users.sort((a,b)=> b.onLine - a.onLine);
                    this.setState({users:users});
                }
                if(this.getUsersIdx("blockedContacts",name) !== -1) {
                    usersBC[this.getUsersIdx("blockedContacts",name)].onLine = true;
                    //let sortUsers = usersBC.sort((a,b)=> b.onLine - a.onLine);
                    this.setState({blockedContacts:usersBC});
                }
            })
            .on('offLine', (name)=> {
                //console.log('receiver user offLine: ',name," ,this.getUsersIdx: ", this.getUsersIdx("users",name));
                let users = this.state.users;
                let usersBC = this.state.blockedContacts;
                if(this.getUsersIdx("users",name) !== -1) {
                    users[this.getUsersIdx("users",name)].onLine = false;
                    //let sortUsers = users.sort((a,b)=> b.onLine - a.onLine);
                    this.setState({users:users});
                }
                if(this.getUsersIdx("blockedContacts",name) !== -1) {
                    usersBC[this.getUsersIdx("blockedContacts",name)].onLine = false;
                    //let sortUsers = usersBC.sort((a,b)=> b.onLine - a.onLine);
                    this.setState({blockedContacts:usersBC});
                }
            })
            .on('message', (data)=> {
                //message receiver
                console.log('message receiver: ',data);
                this.printMessage(data,data.author);
                this.msgCounter("users",this.getUsersIdx("users",data.author));
            })
            .on('messageRoom',(data)=>{
                //messageRoom receiver
                console.log('messageRoom receiver: ',data);
                this.printMessage(data,data.sig);
                this.msgCounter("rooms",this.getUsersIdx("rooms",data.sig));
            })
            .on('typing', (username)=> {
                //receiver
                if(this.getUsersIdx("users",username) < 0) return;
                const typingUser = this.state.users[this.getUsersIdx("users",username)];
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
        element.scrollTop = element.scrollTopMax - this.state.scrollTopMax || element.scrollHeight;
    };

    //req subscribers log
    getLog =(a,e,reqMesCountCb)=>{
        if(this.state.arrayBlockHandlerId === a && this.state.messageBlockHandlerId === this.getUsersIdx(a,e) && reqMesCountCb === null) return;
        let messagesStore = this.state.messagesStore;
        if(!messagesStore[e]) messagesStore[e] = [];
        if(messagesStore[e].length >= 15 && reqMesCountCb === null) return;
        if(!reqMesCountCb) reqMesCountCb = 15;
        //console.log("getLog a,e: ",a,e);
        if(messagesStore[e].length === this.state[a][this.getUsersIdx(a,e)].allMesCounter) return;
        //console.log("getLog: ",a," ,",e," ,",reqMesCountCb);
        this.socket.emit(a === "rooms" ? 'getRoomLog' : 'getUserLog',e,reqMesCountCb,null,(err,arr)=>{
            //console.log("getUserLog arr: ",arr," ,err: ",err);
            if(err) {
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                })
            }else {
                messagesStore[e] = arr;
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
        if(nameStr.length === 0) this.setState({filteredUsers: []});
        this.setState({filteredUsers: this.state.users.filter(this.filterSearch(nameStr))},()=>{
            if(this.state.filteredUsers.length === 0) {
                this.socket.emit('findContacts', nameStr,(err,usersArr)=>{
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({
                            foundContacts: usersArr
                        });
                    }
                })
            }
        });
    };
    //typing msg receiver
    typing =(name,ev)=> {
        //console.log('this.typing sId: ', sId);
        this.setState({message: ev.target.value});
        if(name) {this.socket.emit('typing', name)}
    };
    //unread msgs counter
    msgCounter =(a,i,unreadFlag)=> {
        //console.log("msgCounter a: ",a," ,i: ",i);
        let current = this.state[a][i];
        //console.log("msgCounter current: ",current);
        let currentUserMes = this.state.messagesStore[current.name];
        if(!unreadFlag) current.allMesCounter = current.allMesCounter + 1;
        let unReadMes = currentUserMes.filter(itm => itm.author !== this.state.user.username && itm.recipients.find(itm => itm.username === this.state.user.username).status === false).length;
        current.msgCounter = unReadMes;
        this.setState({current});
    };
    //set current subscriber
    inxHandler =(a,i)=> {
        //console.log('inxHandler arrName: ',a,", arrName inx: ", i);
        this.setState({messageBlockHandlerId: i, arrayBlockHandlerId: a});
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
                            console.log("sendMessage room: ", mes);
                            this.printMessage(mes, name);
                            this.msgCounter("rooms", this.getUsersIdx("rooms", name));
                            this.setState({message: ''}, () => this.scrollToBottom(this.refs.InpUl));
                        }
                    });
                    break;
                case "users":
                    //console.log("sendMessage users");
                    this.socket.emit('message', this.state.message, name, date, (err, mes) => {//This name means User Name
                        if (err) {
                            //console.log("sendMessage users err: ", err);
                            this.setState({
                                modalWindow: true,
                                err: {message: err},
                            })
                        } else {
                            this.printMessage(mes, name);
                            this.msgCounter("users", this.getUsersIdx("users", name));
                            this.setState({message: ''}, () => this.scrollToBottom(this.refs.InpUl));
                        }
                    });
                    break;
                default:
                    //console.log("sendMessage: Sorry, we are out of " + res + ".");
            }

    };
    //send req for log data
    getUsersIdx =(a,i)=> {
        return this.state[a].map((itm)=>{return itm.name;}).indexOf(i);
    };
    //pushing incoming msgs
    printMessage =(data,name)=> {
        let messagesStore = this.state.messagesStore;
        if(!messagesStore[name]) messagesStore[name] = [];
        messagesStore[name].push(data);
        this.setState({messagesStore});
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
                    users:userData.users,
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
                    users:userData.users,
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
       // console.log("historySearch: ",text," ,userName: ",name);
        if(!name || !text || !this.state.arrayBlockHandlerId) return;
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
            let userName = this.state.users[this.state.messageBlockHandlerId].name;
            this.socket.emit(this.state.arrayBlockHandlerId === "rooms" ? 'getRoomLog' : 'getUserLog',userName,null,mesId,(err,arr)=>{
                //console.log("getUserLog arr: ",arr," ,err: ",err);
                if(err) {
                    this.setState({
                        modalWindow:true,
                        err:{message:err},
                    })
                }else {
                    messagesStore[userName] = arr;
                    this.setState({messagesStore}, ()=> this.changeScrollPos(mesId))
                }
            });
        }else {
            //console.log("changeScrollPos mesId: ",mesId, " ,this.refs.InpUl: ",element, " ,this.refs.mesId: ",elemToScroll);
            element.scrollTo(0, elemToScroll.offsetTop - 350)//.scrollTo(0, ref.current.offsetTop)
            this.setState({messageLink: mesId})
        }

    };

    addMe =(name)=> {
        //console.log("addMe: ",name);
        this.setState({
            addMeHandler:true,
            reqAddMeName:name,
            confirmMessage:"Send request to add user "+name+"?"
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
                        users:userData.contacts,
                        addMeHandler: false,
                        confirmMessage:"",
                        reqAddMeName:"",
                        foundContacts:[]
                    },()=>this.printMessage(msgData,this.state.reqAddMeName));
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

    resAddMeHandler =(confirmRes)=>{
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
                        users:userData.contacts,
                        blockedContacts:userData.blockedContacts,
                        resAddMeHandler:false,
                        resAddMeAddMeName:"",
                        confirmMessage:""
                    });
                    this.printMessage(msgData,addUserName);
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
                    if(msgData) this.printMessage(msgData,this.state.changeStatusName);
                    this.setState({
                        users:userData.contacts,
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
    onContextMenuHandler =(res,username,roomName)=>{
        let date = Date.now();
        switch (res) {
            case "inviteUser":
                //console.log("onContextMenuHandler inviteUser roomName: ",roomName,", username: ",username);
                this.socket.emit('inviteUserToRoom',roomName,username,date,(err,data,msgData)=>{
                    //console.log("inviteUserToRoom' cb err: ",err,", cb rooms: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({rooms:data.rooms});
                        this.printMessage(msgData,roomName);
                    }
                });
                break;
            case "banRoomUser":
                //console.log("onContextMenuHandler banRoomUser roomName: ",roomName,", username: ",username);
                this.socket.emit('blockRoomUser',roomName,username,date,(err,data,msgData)=>{
                    //console.log("blockRoomUser' cb err: ",err,", cb rooms: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({rooms:data.rooms});
                        this.printMessage(msgData,roomName);
                    }
                });
                break;
            case "unBanRoomUser":
                //console.log("onContextMenuHandler unBlockRoomUser roomName: ",roomName,", username: ",username);
                this.socket.emit('unBlockRoomUser',roomName,username,date,(err,data,msgData)=>{
                    //console.log("unBlockRoomUser' cb err: ",err,", cb rooms: ",data);
                    if(err) {
                        this.setState({
                            modalWindow:true,
                            err:{message:err},
                        })
                    }else {
                        this.setState({rooms:data.rooms});
                        this.printMessage(msgData,roomName);
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
                        this.printMessage(msgData,roomName);
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
                //console.log("onContextMenuHandler leaveRoom roomName: ",roomName);
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
            case "changeNotificationStatus":
                //console.log("onContextMenuHandler changeNotificationStatus: ");
                //changeNtfStatus
                this.socket.emit('changeNtfStatus',roomName,(err,data)=>{
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
                        this.printMessage(msgData,username);
                        this.setState({
                            users:userData.contacts,
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
                if(this.getUsersIdx("users",username) >= 0) {
                    this.getLog("users",username,null);
                    return this.setState({
                        messageBlockHandlerId:this.getUsersIdx("users",username),
                        arrayBlockHandlerId:"users"
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

    ////////

    //Triggers
    hideModal =()=> {
        this.setState({modalWindow: false,modalWindowMessage:"",err:{}});
    };

    hideShow = (name) => {
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
            let msgCount = this.state.messagesStore[name].length;
            this.setState({scrollTopMax: e.target.scrollTopMax},()=>this.getLog(array,name,msgCount+10));
        }
    };
    setAsRead = (itmName,idx)=>{
        console.log("setAsRead itmName: ",itmName," ,idx: ",idx);
        this.socket.emit('setMesStatus',idx,itmName,(err)=>{
            if(err) {
                this.setState({
                    modalWindow:true,
                    err:{message:err},
                })
            } else {
                let messagesStore = this.state.messagesStore;
                messagesStore[itmName].find(itm => itm._id === idx).recipients.find(itm => itm.username === this.state.user.username).status = true;
                this.setState({messagesStore},()=> {
                    //console.log("setAsRead DONE!");
                    this.msgCounter(this.state.arrayBlockHandlerId,this.state.messageBlockHandlerId,true)})
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
        let currentUser = this.state.users[this.state.messageBlockHandlerId].name;

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
                //this.state.arrayBlockHandlerId ? name : [name,this.state.user.username]



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
                            state.messagesStore[currentUser] = state.messagesStore[currentUser].filter((itm) => !this.state.selectModMsgList.includes(itm._id));
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
                //console.log("onContextMenuBtnResponse Sorry, we are out of " + res + ".");
        }
    };

    forwardHandler =(forwardTo,forwardFrom)=>{
        //console.log("forwardHandler username: ",forwardTo);
        //console.log("forwardHandler selectModMsgList: ",this.state.selectModMsgList);
        this.socket.emit('messageForward', this.state.selectModMsgList, forwardTo,forwardFrom, (err, mesArray) => {
            if (err) {
                //console.log("messageForward: ", err);
                this.setState({
                    modalWindow: true,
                    err: {message: err},
                })
            } else {
                //console.log("messageForward successful updatedMes: ", mesArray);
                mesArray.forEach(itm => this.printMessage(itm, forwardTo));

                this.setState({
                    isForward: false,
                    selectMode:false,
                    isChecked: false,
                    selectModMsgList:[],
                });
                //this.msgCounter("users", this.getUsersIdx("users", username));
            }
        });
    };

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
        return (
            <Page user={this.state.user} title="CHAT PAGE" className="container">
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
                    <div className="chat-users">
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

                                <button onClick={() => this.hideShow("promptSearchUser")} name="msgBtn" type="button" className="btn">
                                    <img src={addUserImg} alt="add user"/>
                                    <span className="tooltiptext">Add user</span>
                                </button>
                            </div>


                            {this.state.showHistorySearch && this.state.messSearchArr.length >= 1 ?
                                <div className='message-block-search'>
                                    {
                                        this.state.messSearchArr.length <=0 ?
                                            <p className='message-count'>Mo messages found</p>
                                            :
                                            <p className='message-count'>Found {this.state.messSearchArr.length} message{this.state.messSearchArr.length > 1 ? 's' :''} </p>
                                    }

                                    <ul className='message-search-list'>
                                        {elements}
                                    </ul>
                                </div>
                                :
                                <div className='chat-users-list'>
                                    <div className="userList white">white list users</div>
                                    {this.state.filteredUsers.length === 0 ?
                                        (this.state.foundContacts.length !== 0) ? (
                                            this.state.foundContacts.map((name, i) => <UserBtn
                                                key={i}
                                                i={i}
                                                name={name}
                                                addMe={() => this.addMe(name)}
                                            />)
                                        ) : this.state.users.map((itm, i) => <UserBtn
                                            key={i}
                                            itm={itm}
                                            i={i}
                                            getUserLog={() => this.getLog("users", itm.name, null)}
                                            inxHandler={() => this.inxHandler("users", i)}
                                            messageBlockHandlerId={this.state.messageBlockHandlerId}
                                            onContextMenuHandler={this.onContextMenuHandler}
                                            banList={false}
                                            roomList={false}
                                        />)
                                        : this.state.users.filter(items => this.state.filteredUsers
                                            .map(i => i.name)
                                            .includes(items.name))
                                            .map((itm, i) => <UserBtn
                                                    key={i}
                                                    itm={itm}
                                                    i={this.getUsersIdx("users", itm.name)}
                                                    getUserLog={() => this.getLog("users", itm.name, null)}
                                                    inxHandler={() => this.inxHandler("users", i)}
                                                    messageBlockHandlerId={this.state.messageBlockHandlerId}
                                                    onContextMenuHandler={this.onContextMenuHandler}
                                                    banList={false}
                                                    roomList={false}
                                                />
                                            )}

                                    {this.state.blockedContacts.length !== 0 ?
                                        <div>
                                            <div className="userList black">black list users</div>
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
                                        : ""}
                                    {this.state.rooms.length !== 0 ?
                                        <div>
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
                                                        userList={this.state.users.map(itm => itm.name)}
                                                        username={this.state.user.username}
                                                        userNRSStatus={itm.members.find(itm => itm.username === this.state.user.username).enable}//user Room notification status
                                                    />)
                                            }
                                        </div>
                                        : ""}
                                </div>}
                        </div>
                    </div>

                    {
                        ((a, e) => {
                            //console.log('message-block: e:',e,", a:",a);
                            let eUser = {};
                            let eStore = {};
                            if (a !== undefined && e !== undefined) {eUser = this.state[a][e]}
                            else eUser = undefined;
                            if(eUser !== undefined && eUser.name !== undefined) {eStore = this.state.messagesStore[eUser.name]}
                            else eStore = undefined;
                            return (
                                <div className="message-block">
                                    <div name="chatRoom" id="chatDiv">

                                            <div className={`btnMessageGroup ${this.state.isChecked ? "show" : ""}`}>
                                                <button className="btn" data-loading-text="Deleting..." onClick={()=>this.onContextMenuBtnResponse('Delete Selected')}>Delete</button>
                                                <button className="btn" data-loading-text="Forward to..." onClick={()=>this.onContextMenuBtnResponse('Forward to')}>Forward to</button>

                                            </div>
                                            <div className={`forwardUserList ${this.state.isForward ? "show" : ""}`}>
                                                <ul>
                                                    {this.state.users.map((user,i)=> <li key={i} onClick={()=> this.forwardHandler(user.name,eUser.name)} className="btn user">{user.name}</li>)}
                                                </ul>
                                            </div>


                                        {a === "rooms" ?
                                            <div onClick={() => this.hideShow("roomPropsWindow")}>
                                                <ItmProps room={eUser}/>
                                            </div> : e !== undefined ?
                                                <div onClick={() => this.hideShow("userPropsWindow")}>
                                                    <ItmProps user={eUser}/>
                                                </div> : ""}

                                        {this.state.showHistorySearch ?
                                            <div className='historySearchInpWrapper'>
                                                <input name="historySearchInp" ref="historySearchInp"
                                                       className={`form-control searchInChat ${this.state.showHistorySearch ? "show" : ""}`}
                                                       autoComplete="off" autoFocus placeholder="Search..."
                                                       onChange={ev => this.historySearch(ev.target.value,this.state.arrayBlockHandlerId === "room" ? eUser : eUser.name)}/>
                                                    <div className='modal-main-btnRight-center' onClick={()=> this.hideShow("showHistorySearch")}>X</div>

                                            </div> : ""}



                                        <ul onScroll={(evn)=>this.onScrollHandler(evn,eUser.name,a,e)}
                                            onContextMenu={(e)=>{e.preventDefault();this.rightClickMenuOn(e); return false;}}
                                            name="InpUl" className="chat-list" ref="InpUl">
                                            {
                                                (eUser && eStore) ? (
                                                    eStore.map((data, i) => {
                                                        return (
                                                            (data.author === this.state.user.username && data.forwardFrom == null)?(
                                                                <li key={i} className={`right ${this.state.messageLink === data._id ? 'active' :''}`} ref={data._id}>{data.text}
                                                                    <div className="messageData">
                                                                        {this.state.selectMode ?
                                                                            <label htmlFor={`${data._id}`} className="label-cbx">
                                                                                <input id={`${data._id}`} type="checkbox" name="msgCB" className="invisible"
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
                                                                            {data.author}<span className="messageTime">{this.dateToString(data.date)}</span>
                                                                            <span className="messageTime">
                                                                               {
                                                                                   data.recipients.length === 1 ? data.recipients[0].status === true ? " R":"" :
                                                                                       data.recipients.map((itm,i) => itm.status === true ? <span key={i} className="messageTime">{itm.username}</span> : "")
                                                                               }
                                                                            </span>
                                                                            {data.forwardFrom == null ? "" : " Forwarded from: " + data.forwardFrom }
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            ):(
                                                                <VisibilitySensor
                                                                    key={i+"VisibilitySensor"}
                                                                    containment={this.refs.InpUl}
                                                                    onChange={(inView)=> inView &&
                                                                        data.recipients.some(itm => itm.username === this.state.user.username) &&
                                                                        data.recipients.find(itm => itm.username === this.state.user.username).status === false ? this.setAsRead(eUser.name,data._id) : ""}
                                                                >
                                                                    <li className={`left ${this.state.messageLink === data._id ? 'active' :''}`}  key={i} ref={data._id}
                                                                        onClick={()=>{
                                                                            data.recipients.find(itm => itm.username === this.state.user.username).status === false  ?
                                                                                this.setAsRead(eUser.name,data._id) : ""
                                                                        }}
                                                                    >
                                                                        {data.text}
                                                                        <span className="messageData">
                                                                             {this.state.selectMode ?
                                                                                 <label htmlFor={`${data._id}`} className="label-cbx">
                                                                                     <input id={`${data._id}`} type="checkbox" name="msgCB" className="invisible"
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
                                                                                <span className="messageTime">{this.dateToString(data.date)}</span>
                                                                                {
                                                                                    data.recipients.length === 1 ? data.recipients[0].status === true ? "":" UR" :
                                                                                        data.recipients.map((itm,i) => itm.status === true ? <span key={i} className="messageTime">{itm.username}</span> : "")
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
                                                                name="msgBtn"  className="btn">
                                                            SEND</button> :
                                                        <button onClick={() => this.resAddMe(eUser.name)} name="msgBtn"
                                                                type="button" className="btn">ALLOW USER</button>
                                                }
                                            </div>
                                        </form>
                                    </div>
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


