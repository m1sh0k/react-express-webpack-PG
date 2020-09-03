import React from 'react';

class UserPropsWindow extends React.Component {
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
        console.log('userPropsWindow: ',this.props);
        let curentUser = this.props.curentUser;

        return (
            <div className={this.props.show ? 'modal display-block' : 'modal display-none'}>
                <section className='modal-main'>
                    <div className='modal-main-btnRight' onClick={this.props.handleClose}>X</div>
                    <h1 className="chat-room-name">{curentUser.name}: </h1>
                    <div className="chat-room-info">

                        <div>
                            <p className="chat-room-members-count">Id:</p>
                            <p className="chat-room-members-count">Messages:</p>
                            <p className="chat-room-members-count">Unread Messages:</p>
                            <p className="chat-room-members-count">Created at:</p>
                            <p className="chat-room-members-count">Status:</p>
                            <p className="chat-room-members-count">Authorized:</p>
                            <p className="chat-room-members-count">Banned:</p>
                        </div>
                        <div>
                            <p className="chat-room-members-count">{curentUser.userId}</p>
                            <p className="chat-room-members-count">{curentUser.allMesCounter} </p>
                            <p className="chat-room-members-count">{curentUser.msgCounter} </p>
                            <p className="chat-room-members-count">{this.dateToString(curentUser.created_at)}</p>
                            <p className="chat-room-members-count">{curentUser.onLine ? "onLine":"offLine"}</p>
                            <p className="chat-room-members-count">{curentUser.authorized ? "Yes":"No"}</p>
                            <p className="chat-room-members-count">{curentUser.banned ? "Yes":"No"}</p>
                        </div>
                    </div>
                </section>
            </div>

        )
    }
}

export default UserPropsWindow;
