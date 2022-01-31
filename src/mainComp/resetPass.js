import React from 'react';
import Page from '../layout/page.js';
import {Redirect} from 'react-router-dom'
import Modal from '../partials/modalWindow.js'



class ResetPass extends React.Component {

    constructor (props) {

        super(props);
        this.state = {
            chatRedirect: false,
            errorRedirect:false,
            mainPageRedirect:false,
            modalWindow:false,
            err:{}
        };
    };

    hideModal = () => {
        this.setState({modalWindow: false,err:''});
    };

    handleChange =(e)=> {
        this.setState({ [e.target.name]: e.target.value });
    };

    regExpr =(name)=> {
        var a = /[ !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;//special letters & numbers
        return name.match(a);
    };

    regEnglish =(name)=> {
        var a =/[^\x00-\x7F]/;//letters from a-z && A-Z
        return name.match(a);
    };


    sendAuth =(e) => {
        e.preventDefault();
        let username = this.state.username;
        //console.log('sendAuth username:',username,',','password: ',password);
        if(!username) {
            this.setState({
                err: {message:'You forgot type name, email!'}, modalWindow:true,
            });
            return;
        }
        var data = 'username=' + encodeURIComponent(this.state.username);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/resetPassword',true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(data);
        xhr.onload = () => {
            if (xhr.readyState === xhr.DONE) {
                if (xhr.status === 200) {
                    this.setState({err: {message:"We have sent you an email with a link to reset your password."}});
                    this.setState({modalWindow: true},()=>{
                        setTimeout(()=>this.setState({ mainPageRedirect: true }),2000)
                    });
                }
                else {
                    //console.log('xhr.onload: ','err');
                    if(xhr.status === 403) {
                        this.setState({err: JSON.parse(xhr.response)});
                        this.setState({modalWindow: true},);
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

        //console.log('/login user:',this.state.user);
        if(this.state.chatRedirect) {return <Redirect to='/chat'/>;};
        if(this.state.errorRedirect) {return <Redirect to='/error' />};
        if(this.state.mainPageRedirect) {return <Redirect to='/' />};
        if(this.state.login) {return <Redirect to='/login' />};
        return (
            <Page user={this.state.user} title="RESET PASSWORD PAGE" className="container">
                {(this.state.modalWindow)?(
                    <Modal show={this.state.modalWindow} handleClose={this.hideModal} err={this.state.err}/>
                ):('')}
                <form onSubmit={this.sendAuth} className="login-form page-login" name="loginform" id="form">
                    <div className="form-group">
                        <label htmlFor="input-username" className=" control-label">Name/Email</label>
                        <input name="username"  type="text" className="form-control" id="input-username" placeholder="Name" ref="nInp" onChange={this.handleChange}/>
                    </div>
                    <div className="form-group">
                        <div className="wrapper" >
                            <button type="submit" className="btn" data-loading-text="Sending...">RESET PASSWORD</button>
                        </div>
                    </div>
                </form>
            </Page>
        )
    }
}

export default ResetPass;