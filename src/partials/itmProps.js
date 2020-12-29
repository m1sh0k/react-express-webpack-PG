import React from 'react';


class RoomManager extends React.Component {

    constructor(props) {
        super(props);
        this.state = {

        }
    }

    dateToString =(datestr)=> {
        let currentdate = new Date(datestr);
        return currentdate.getHours() + ":" + currentdate.getMinutes() + "/" + currentdate.getDate() + ":" + (currentdate.getMonth()+1) + ":" + currentdate.getFullYear()// + ":"+ currentdate.getSeconds();
    };

    render() {
        //console.log("itmProps: ", this.props);

        return (

            <div>
                {
                    (this.props.room) ?  (
                        <div className="chat-room-info">
                            <a className="chat-room-name">{this.props.room.name}</a>
                            <a className="chat-room-members-count">{this.props.room.members.length} members</a>
                        </div>
                    ) : (this.props.channel) ?  (
                        <div className="chat-room-info">
                            <a className="chat-room-name">{this.props.channel.name}</a>
                            <a className="chat-room-members-count">{this.props.channel.members.length} members</a>
                        </div>
                    ) : ( this.props.user ?
                        <div className="chat-room-info">
                            <a className="chat-room-name">{this.props.user.name}</a>
                            <a className="chat-room-members-count">id:{this.props.user.userId}</a>
                        </div> : ""
                    )
                }

            </div>
        )
    }
}

export default RoomManager;
