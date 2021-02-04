import React from 'react';


class OnContextMenu extends React.Component {

    constructor(props){
        super(props);
        this.state = {
            onEnterUserList:false,
            onEnterUserRoomList:false,
            onEnterBanUserRoomList:false,
        }
    }

    showHideList =(list)=>{
        this.setState({[list]: !this.state[list]});
    };



    render() {
        //console.log("OnContextMenu props: ",this.props);
        const OnEnterUserList =()=>{
            return (
                <ul className="userInvite"  >
                    {this.props.userList.map((name,i) => <li className='dropDownBtn' key={i} onClick={()=>{this.props.onContextMenuResponse("inviteUser",name)}}>{name}</li>)}
                </ul>
            )
        };
        const OnEnterContacts =()=>{
            return (
                <ul className="userInvite"  >
                    {this.props.contacts.map((name,i) => <li className='dropDownBtn' key={i} onClick={()=>{this.props.onContextMenuResponse("shareContact",name)}}>{name}</li>)}
                </ul>
            )
        };
        const OnEnterUserRoomList =(prop)=>{
            switch(prop.action){
                case "banRoomUser":
                    return (
                        <ul className="userInvite" style={{top:25}}>
                            {this.props.userRoomList.filter(itm => !itm.admin).map(itm => itm.username).map((name,i) => <li className='dropDownBtn' key={i} onClick={()=>{this.props.onContextMenuResponse("banRoomUser",name)}}>{name}</li>)}
                        </ul>
                    );
                    break;
                case "setRoomAdmin":
                    return (
                        <ul className="userInvite" style={{top:50}}>
                            {this.props.userRoomList.filter(itm => !itm.admin).map(itm => itm.username).map((name,i) => <li className='dropDownBtn' key={i} onClick={()=>{this.props.onContextMenuResponse("setRoomAdmin",name)}}>{name}</li>)}
                        </ul>
                    );
                    break;
                default: console.log("OnEnterUserRoomList Sorry, we are out of " + prop.action + ".")
            }
        };
        const OnEnterBanUserRoomList =()=>{
            return (
                <ul className="userInvite" style={{top:75}}>
                    {this.props.userBanRoomList.map((name,i) => <li className='dropDownBtn' key={i} onClick={()=>{this.props.onContextMenuResponse("unBanRoomUser",name)}}>{name}</li>)}
                </ul>
            )
        };
        return (

            <div>
                {this.props.roomList === true ?
                    <ul className="userDropDown"  style={this.props.contextMenuLocation}>
                        <li className='dropDownBtn invite'
                            onMouseEnter={(e)=>{e.preventDefault();e.stopPropagation();this.showHideList("onEnterUserList")}}
                            onMouseLeave={()=>this.showHideList("onEnterUserList")} >Invite user
                            <OnEnterUserList/>
                        </li>

                        {
                            this.props.userRoomList ?
                                <div>
                                    <li className='dropDownBtn invite' onMouseEnter={(e)=>{e.preventDefault();e.stopPropagation();this.showHideList("onEnterUserRoomList")}} onMouseLeave={()=>this.showHideList("onEnterUserRoomList")} >Ban user
                                        <OnEnterUserRoomList action="banRoomUser"/>
                                    </li>
                                    <li className='dropDownBtn invite' onMouseEnter={(e)=>{e.preventDefault();e.stopPropagation();this.showHideList("onEnterUserRoomList")}} onMouseLeave={()=>this.showHideList("onEnterUserRoomList")} >Set Admin
                                        <OnEnterUserRoomList action="setRoomAdmin"/>
                                    </li>
                                </div> : ''
                        }
                        {
                            this.props.userBanRoomList.length !== 0 ?
                                <li className='dropDownBtn invite' onMouseEnter={(e)=>{e.preventDefault();e.stopPropagation();this.showHideList("onEnterBanUserRoomList")}} onMouseLeave={()=>this.showHideList("onEnterBanUserRoomList")} >Unban user
                                    <OnEnterBanUserRoomList/>
                                </li> : ''
                        }

                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("moveRoomOnTop")}}>Move group on top</li>
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("viewRoomData")}}>View group data</li>
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("clearRoomWindow")}}>Clear group window</li>
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("leaveRoom")}}>Leave group</li>
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("chgRNtfStatus")}}>{this.props.userNRSStatus ? "Disable Notifications" : "Enable Notifications"}</li>
                    </ul>
                : this.props.channelList ?
                        <ul className="userDropDown"  style={this.props.contextMenuLocation}>
                            <li className='dropDownBtn invite'
                                onMouseEnter={(e)=>{e.preventDefault();e.stopPropagation();this.showHideList("onEnterUserList")}}
                                onMouseLeave={()=>this.showHideList("onEnterUserList")} >Invite user
                                <OnEnterUserList/>
                            </li>
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("moveChannelOnTop")}}>Move channel on top</li>
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("viewChannelData")}}>View channel data</li>
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("clearChannelWindow")}}>Clear channel window</li>
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("leaveChannel")}}>Leave channel</li>
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("chgChNtfStatus")}}>{this.props.userNRSStatus ? "Disable Notifications" : "Enable Notifications"}</li>
                        </ul>
                        :
                        <ul className="userDropDown" onMouseLeave={this.props.rightClickMenuOnHide} style={this.props.contextMenuLocation}>
                        {
                            this.props.contacts ?
                                <li className='dropDownBtn invite' onMouseEnter={(e)=>{e.preventDefault();e.stopPropagation();this.showHideList("onEnterUserList")}} onMouseLeave={()=>this.showHideList("onEnterUserList")} >Share contact
                                    <OnEnterContacts/>
                                </li> : ""
                        }
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("shareLocation")}}>Share location</li>
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("moveOnTop")}}>Move on top</li>
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("viewUserData")}}>View user data</li>
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("clearChatWindow")}}>Clear chat window</li>
                        {this.props.banList === false ?
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("banUser")}}>Ban user</li>:
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("unBanUser")}}>Allow user</li>
                        }
                        <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("deleteUser")}}>Delete user</li>
                        {this.props.authorizedStatus === false ?
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("reqAuth")}}>Request authorization</li>:""
                        }
                            <li className='dropDownBtn' onClick={(e)=>{e.preventDefault();e.stopPropagation();this.props.onContextMenuResponse("chgUNtfStatus")}}>{this.props.userNRSStatus ? "Disable Notifications" : "Enable Notifications"}</li>
                    </ul>
                }

            </div>
        )
    }
}

export default OnContextMenu;