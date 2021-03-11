import React from 'react';
import OnContextMenu from './onContextMenuWindow.js'
import moveArrow from './../../public/img/move-arrow.png'
let contentMenuStyle = {
    display: location ? 'block' : 'none',
    position: 'absolute',
    left: location ? location.x : 0,
    top: location ? location.y : 0
};


class UserBtn extends React.Component {

    constructor(props){
        super(props);
        this.state = {
            onContextMenu: false,
            onContextMenuUserName:"",
            authorizedStatus:undefined,
            banStatus:undefined,
            contextMenuLocation: contentMenuStyle,
            itmType: this.props.contactList ? 'contacts' : this.props.banList ? 'blockedContacts' : this.props.roomList ? 'rooms' : this.props.channelList ? 'channels' : undefined,
        }
    }

    componentDidMount(){

    }

    rightClickMenuOn =(itm,e)=> {
        //console.log("rightClickMenuOn itm: ",itm);
        //console.log("rightClickMenuOn e.pageX: ",e.pageX," ,e.pageY",e.pageY);
        this.setState({
            onContextMenu:true,
            onContextMenuUserName:itm.name,
            authorizedStatus:itm.authorized,
            banStatus:itm.banned,
            contextMenuLocation: {left: e.pageX, top:e.pageY}
        })
    };

    rightClickMenuOnHide =()=> {
        //console.log("rightClickMenuOnHide");
        this.setState({
            onContextMenu: false,
            onContextMenuUserName:"",
            authorizedStatus:undefined,
            banStatus:undefined,
            contextMenuLocation: contentMenuStyle
        });
    };

    onContextMenuResponse =(res,username)=> {
        //console.log("onContextMenuResponse res: ", res);
        switch (res){
            case "shareContact":
            case "shareLocation":
            case "inviteUser":
            case "banRoomUser":
            case "unBanRoomUser":
            case "setRoomAdmin":
            case "chgUNtfStatus":
                this.props.onContextMenuHandler(res,username,this.state.onContextMenuUserName);
                this.setState({onContextMenu:false});
                break;
            case "leaveRoom":
            case "leaveChannel":
            case "viewRoomData":
            case "moveRoomOnTop":
            case "chgRNtfStatus":
            case "chgChNtfStatus":
            case "clearRoomWindow":
            case "clearChannelWindow":
                this.props.onContextMenuHandler(res,null,this.state.onContextMenuUserName);
                this.setState({onContextMenu:false});
                break;
            default:
                this.props.onContextMenuHandler(res,this.state.onContextMenuUserName,null);
                this.setState({onContextMenu:false});
        }
    };

    render() {
        //console.log('UserBtn props: ',this.props);
        let itm = this.props.itm;
        let i = this.props.i;
        return (
            <div key={i}
                 onClick={()=>{
                     if(this.props.addMe) {
                     this.props.addMe()
                 } else {
                         this.props.inxHandler();
                         this.props.getUserLog();
                 }}}
                 onContextMenu={
                     (e)=>{
                         e.preventDefault();
                         this.rightClickMenuOn(itm,e);
                         this.props.inxHandler();
                         return false;
                     }
                 }
                 onMouseLeave={this.rightClickMenuOnHide}
                 type="button"
                 className={`btn user ${this.props.messageBlockHandlerId === i ?"clicked ":""}`}
            >
                {this.props.roomList ? <div className="user-icon"/> :""}
                {this.props.channelList ? <div className="channel-icon"/> :""}
                {itm ?
                    <div className="userStatus">
                        <ul>
                            <li>
                                {itm.msgCounter !== 0 || itm.msgCounter === undefined ?
                                    <div className="unread-mess">
                                       {itm.msgCounter}
                                    </div>
                                    :""}
                            </li>
                            {!this.props.roomList && !this.props.channelList ? <li className={` statusNet ${itm.onLine ? "onLine":"offLine"}`}/>:""}
                        </ul>
                    </div>
                    :""}
                {this.props.name ? <font>{this.props.name}</font> : <font color={!itm.authorized ? "#a2a215" : itm.banned ? "#c33131": itm.onLine ? "#fff" :"#a09b9b"}>{itm.name}</font>}
                {itm ?
                        <div className="userItm">
                            <div className="typing">
                                {itm.typing ?
                                    <div className="loader">
                                        <span/>
                                    </div>
                                    :""}
                            </div>
                        </div>
                    :""}
                {this.state.onContextMenu ?
                    <OnContextMenu
                        authorizedStatus={this.state.authorizedStatus}
                        banList={this.props.banList}
                        roomList={this.props.roomList}
                        channelList={this.props.channelList}
                        rightClickMenuOnHide={this.rightClickMenuOnHide}
                        onContextMenuResponse={this.onContextMenuResponse}
                        contextMenuLocation={this.state.contextMenuLocation}
                        userList={this.props.userList ? this.props.userList.filter(name => !itm.members.map(itm => itm.username).some(itm => itm === name)) : ""}
                        contacts={this.props.contacts ? this.props.contacts : ""}
                        curentUser={itm.members.find(itm => itm.username === this.props.username)}
                        userRoomList={this.props.roomList || this.props.channelList ? itm.members.filter(itm => itm.username !== this.props.username)/*.map(itm => itm.username).filter(name => name !== this.props.username)*/ : ''}//filter added users in room
                        userBanRoomList={this.props.roomList ? itm.blockedMembers.map(itm => itm.username) : ''}
                        userNRSStatus={this.props.userNRSStatus}
                    />
                    :''}
                {
                    this.state.itmType !== undefined ?
                        <div className='move-item'>
                            <div className='move-up move-btn'
                                 onClick={()=>this.props.changeItmPosArray(this.state.itmType,itm.name,'upItmArray')}
                                 onDoubleClick={()=>this.props.changeItmPosArray(this.state.itmType,itm.name,'upTopItmArray')}
                            >
                                <img src={moveArrow} alt="move-up"/>
                            </div>
                            <div className='move-down move-btn'
                                 onClick={()=>this.props.changeItmPosArray(this.state.itmType,itm.name,'downItmArray')}
                                 onDoubleClick={()=>this.props.changeItmPosArray(this.state.itmType,itm.name,'downBotItmArray')}
                            >
                                <img src={moveArrow} alt="move-down"/>
                            </div>
                        </div> : ""
                }

            </div>
        )
    }
}

export default UserBtn;
