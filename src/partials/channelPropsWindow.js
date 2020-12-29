import React from 'react';

class ChannelPropsWindow extends React.Component {
    constructor (props) {
        super(props);
        this.state = {

        };
    };

    dateToString =(datestr)=> {
        let currentdate = new Date(datestr);
        return currentdate.getHours() + ":" + currentdate.getMinutes() + "/" + currentdate.getDate() + ":" + (currentdate.getMonth()+1) + ":" + currentdate.getFullYear()// + ":"+ currentdate.getSeconds();
    };


    render() {
        console.log('channelPropsWindow: ',this.props);
        let currentChannel = this.props.curentChannel;

        return (
            <div className={this.props.show ? 'modal display-block' : 'modal display-none'}>
                <section className='modal-main'>
                    <div className='modal-main-btnRight' onClick={this.props.handleClose}>X</div>
                    <h1 className="chat-room-name">{currentChannel.name}: </h1>

                    <div className="chat-room-info">
                        <div>
                            <p className="chat-room-members-count">Id:</p>
                            <p className="chat-room-members-count">Members count:</p>
                            <p className="chat-room-members-count">Messages:</p>
                            <p className="chat-room-members-count">Unread Messages:</p>
                            <p className="chat-room-members-count">Created at:</p>
                        </div>
                        <div>
                            <p className="chat-room-members-count">{currentChannel.channelId}</p>
                            <p className="chat-room-members-count">{currentChannel.members.length}</p>
                            <p className="chat-room-members-count">{currentChannel.allMesCounter} </p>
                            <p className="chat-room-members-count">{currentChannel.msgCounter} </p>
                            <p className="chat-room-members-count">{this.dateToString(currentChannel.created_at)}</p>
                        </div>
                    </div>
                    <div className="userList white"  >
                        {currentChannel.members.length > 0 ?
                        <h1 className="chat-room-name">{currentChannel.name} members:</h1>
                            :""}
                        {
                            currentChannel.members ?
                                currentChannel.members.map((itm,i) =>
                                    <p className={`chat-room-members-count ${itm.admin === true ? "admin" :""}`} key={i}>
                                        {itm.creator === true ? "FOUNDER: " :""}
                                        <span>
                                            {itm.username}
                                        </span>
                                    </p>
                                )
                            : ""
                        }
                    </div>
                </section>
            </div>

        )
    }
}

export default ChannelPropsWindow;
