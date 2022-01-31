import React from 'react';
import Page from '../layout/page.js';
import {Redirect} from 'react-router-dom'
import Modal from '../partials/modalWindow.js'



class ResetPass extends React.Component {

    constructor (props) {

        super(props);
        console.log("props: ",props);
        this.state = {
            chatRedirect: false,
            errorRedirect:false,
            modalWindow:false,
            userId:props.userId,
            token:props.token,
        };
    };

    hideModal = () => {
        this.setState({modalWindow: false});
    };

    handleChange =(e)=> {
        var name = this.refs.nInp;
        if(e.target.name === "username") {
            //console.log("inpName: ",e.target.name,",","inpVal: ", e.target.value);
            //console.log("regExpr: ",this.regExpr(e.target.value),",","regEnglish: ", this.regEnglish(e.target.value));

            if(!this.regExpr(e.target.value) && !this.regEnglish(e.target.value)) {
                name.style.color = '#69bc37';
            } else {
                name.style.color = '#ca5b53';
            };

        }
        this.setState({ [e.target.name]: e.target.value });
        var keyLog = e.currentTarget.value;
        var password = this.refs.pInp;
        var confirmPassword = this.refs.cPInp;
        if(keyLog == this.state.password || keyLog == this.state.confirmPassword) {
            confirmPassword.style.color = '#69bc37';
            password.style.color = '#69bc37';
        } else {
            confirmPassword.style.color = '#ca5b53';
            password.style.color = '#ca5b53';
        };
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
        let password = this.state.password;
        let confPass = this.state.confirmPassword;

        if (!password || !confPass) {
            this.setState({
                err: {message:'You forgot type passwords!'}, modalWindow:true,
            });
            return; //alert('You forgot type passwords!');
        }
        if (password !== confPass) {
            this.setState({
                err: {message:'Passwords not equal! Change passwords and try one more.'}, modalWindow:true,
            });
            return; //alert('Passwords not equal! Change passwords and try one more.');
        }
        var data = '&password=' + encodeURIComponent(this.state.password);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/changePassword/'+this.state.token+'/'+this.state.userId,true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(data);
        xhr.onload = () => {
            if (xhr.readyState === xhr.DONE) {
                if (xhr.status === 200) {
                    //console.log('UP xhr.response: ',xhr.response);
                    this.setState({err: {message:"You successful change password!"}});
                    this.setState({modalWindow: true},()=>{
                        setTimeout(()=>this.setState({ chatRedirect: true }),2000)
                    });
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

        //console.log('/login user:',this.state.user);
        if(this.state.chatRedirect) {return <Redirect to='/chat'/>;};
        if(this.state.errorRedirect) {return <Redirect to='/error' />};
        return (
            <Page user={this.state.user} title="CHANGE PASSWORD PAGE" className="container">
                {(this.state.modalWindow)?(
                    <Modal show={this.state.modalWindow} handleClose={this.hideModal} err={this.state.err}/>
                ):('')}
                <form onSubmit={this.sendAuth} className="login-form page-login" name="loginform" id="form">
                    <div className="form-group">
                        <label htmlFor="input-password" className="control-label">New Password</label>
                        <input name="password"  type="password" className="form-control" id="input-password" placeholder="Password" ref="pInp" onChange={this.handleChange}/>
                    </div>
                       <div className="form-group">
                           <label htmlFor="input-password" className="control-label">Confirm Your New Password</label>
                           <input name="confirmPassword"  type="password" className="form-control" id="confirm-password" placeholder="Password" ref="cPInp" onChange={this.handleChange}/>
                       </div>
                    <div className="form-group">
                        <div className="wrapper" >
                            <button type="submit" className="btn" data-loading-text="Sending...">CHANGE PASSWORD</button>
                        </div>
                    </div>
                </form>
            </Page>
        )
    }
}

export default ResetPass;