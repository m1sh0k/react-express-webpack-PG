import React from 'react';
import Page from '../layout/page.js';
import {Redirect} from 'react-router-dom'
import Modal from '../partials/modalWindow.js'

class LoginP extends React.Component {

    constructor (props) {

        super(props);
        this.state = {
            chatRedirect: false,
            errorRedirect:false,
            modalWindow:false,
            err:undefined,
        };
    };
    showModal = () => {
        this.setState({err: {message:'This is test modal window. Dont worry be happy.'}});
        this.setState({modalWindow: true});
    };


    hideModal = () => {
        this.setState({modalWindow: false});
    };

    handleChange =(evt)=> {
        this.setState({ [evt.target.name]: evt.target.value });
    };

    sendAuth =(e) => {
        e.preventDefault();
        if(!this.state.username || !this.state.username) {
            this.setState({
                err: {message:'You forgot type name, or password, try one more!'},
                modalWindow:true,
            });
            return;
        }
        var data = 'username=' + encodeURIComponent(this.state.username)+'&password=' + encodeURIComponent(this.state.password);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/login',true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(data);
        xhr.onload = () => {
            if (xhr.readyState === xhr.DONE) {
                if (xhr.status === 200) {
                    //console.log('UP xhr.response: ',xhr.response);
                    sessionStorage.setItem('user', xhr.response);
                    this.setState({ chatRedirect: true });
                }
                else {
                    //console.log('xhr.onload: ','err');
                    if(xhr.status === 403) {
                        this.setState({err: JSON.parse(xhr.response)});
                        this.setState({modalWindow: true});
                    } else {
                        sessionStorage.setItem('error', xhr.response);
                        this.setState({ errorRedirect: true });
                    }
                }
            }
        };
        return false;
    };

    render() {
        console.log('/login user:',this.state.chatRedirect);
        if(this.state.chatRedirect) {return <Redirect to='/chat'/>;};
        if(this.state.errorRedirect) {return <Redirect to='/error' />};
        return (
            <Page user={this.state.user} chatRedirect={this.state.chatRedirect} title="LOGIN PAGE" className="container">
                {this.state.modalWindow ?
                    <Modal show={this.state.modalWindow} handleClose={this.hideModal} err={this.state.err}/>
                :''
                }

                <form onSubmit={this.sendAuth} className="page-login" name="loginform" id="form">
                    <div className="form-group">
                        <label htmlFor="input-username" className=" control-label">Name</label>
                        <input name="username"  type="text" className="form-input" id="input-username" placeholder="Name" onChange={this.handleChange}/>
                    </div>
                    <div className="form-group">
                        <label htmlFor="input-password" className="control-label">Password</label>
                        <input name="password"  type="password" className="form-input" id="input-password" placeholder="Password" onChange={this.handleChange}/>

                    </div>
                    <div className="form-group">
                        <div className="wrapper" >
                            <button type="submit" className="btn" data-loading-text="Sending...">SIGN IN</button>
                        </div>
                    </div>
                </form>
            </Page>
        )
    }
}

export default LoginP;