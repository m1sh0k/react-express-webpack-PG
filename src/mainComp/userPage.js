import React from 'react';
import Page from '../layout/page.js';
import {Redirect} from 'react-router-dom'
import CryptoJS from 'crypto-js'
import Modal from '../partials/modalWindow.js'
import Prompt from '../partials/promptModalWindow.js'
import Confirm from '../partials/confirmModalWindow.js'


class UserP extends React.Component {
    constructor (props) {

        let user = JSON.parse(sessionStorage.getItem('user')).user;
        console.log("UP user: ",user);
        let image='';
        if(user.avatar) {
            image = `data:image/png;base64,${user.avatar}`
        } else image = undefined;
        //console.log("img: ",image);
        super(props);
        this.state = {
            chatRedirect: false,
            errorRedirect:false,
            frontpageRedirect: false,
            buffCkName:undefined,
            user: user,
            newNameStatus:undefined,
            modalWindow:false,
            ConfirmModalWindow:false,
            PromptModalWindow:false,
            promptRes:undefined,
            confirmRes:undefined,
            userImg:image,
            userImgFile:undefined,
        };
    };
    //modal window handler
    hideModal = () => {
        this.setState({modalWindow: false});
    };
    //prompt window handler
    hidePrompt = () => {
        this.setState({PromptModalWindow: false});
    };
    //prompt window show
    showPrompt = (promptMessage) => {
        console.log('promptMessage: ',promptMessage);
        this.setState({promptMessage: promptMessage,PromptModalWindow: true});
    };
    //prompt window handler
    promptHandler = (promptRes) => {
        console.log('promptRes: ',promptRes);
        this.setState({promptRes: promptRes,PromptModalWindow: false});
        if(this.state.promptMessage === "Confirm You Password:") {
            this.setState({promptPass: promptRes,PromptModalWindow: false});
            this.setState({confirmMessage: "Are You ready to delete your account? " +
            "Pres Ok to delete or Cancel to regect",ConfirmModalWindow: true});
        }
    };
    //confirm window handler
    confirmHandler = (confirmRes) => {
        console.log('confirmRes: ',confirmRes);
        this.setState({confirmRes: confirmRes,ConfirmModalWindow: false});
        if(this.state.promptMessage === "Confirm You Password:") {
            this.setState({confirmRes: confirmRes,ConfirmModalWindow: false},()=>this.deleteAccount());
        }
    };
    //delete user account
    deleteAccount = ()=> {
        //e.preventDefault();
        let name = this.state.user.username;
        let checkPass = this.state.promptPass;
        let result = this.state.confirmRes;
        console.log('checkPass: ',checkPass,',','result: ',result);
        if(!checkPass || !this.checkHash(this.state.user.hashedPassword,this.state.user.salt,checkPass)) {
            this.setState({err: {message:'Empty password or wrong password!'}, modalWindow:true,});
            return; //alert('Empty password or wrong password!');
        }
        if(!result) {
            this.setState({err: {message:'Ok Your account will not be deleted!'}, modalWindow:true,});
            return; //alert("Ok Your account will not be deleted!");
        }
        let data = 'deleteUsername=' + encodeURIComponent(name) + '&checkPass=' + encodeURIComponent(checkPass);
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/deleteAccount',true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(data);
        xhr.onload =()=>  {
            if (xhr.readyState === xhr.DONE) {
                if (xhr.status === 200) {
                    this.setState({err: {message:'User data deleted successful'}, modalWindow:true,});
                    //return alert('User data deleted successful');
                    sessionStorage.removeItem('user');
                    sessionStorage.removeItem('error');
                    setTimeout(()=>{this.setState({ frontpageRedirect: true });},2000)

                } else {
                    //console.log('xhr.onload: ','err');
                    sessionStorage.setItem('error', xhr.response);
                    this.setState({ errorRedirect: true });
                }
            }
        };
        return false;
    };
    //Check for regular expressions
    regExpr =(name)=> {
        var a = /[ !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
        return name.match(a);
    };
    //Check ReWriten newUsername
    ckReName =(e)=> {
        var newUsername = this.refs.nUInp;
        var newName = e.currentTarget.value;
        if(this.regExpr(newName)) {
            this.setState({err: {message:'Don not use special characters in name!'}, modalWindow:true,});
            return; //alert('Don not use special characters in name');
        }
        if(newName == this.state.buffCkName || newName == this.state.user.username || this.regExpr(newName)) {newUsername.style.color = '#69bc37';}
        else {newUsername.style.color = '#ca5b53';}
    };
    //Reade and validate input password
    ckPass =(e)=> {
        var keyLog = e.currentTarget.value;
        var pass = this.refs.oPInp;//Password inp field
        if(this.checkHash(this.state.user.hashedPassword,this.state.user.salt,keyLog)) {
            pass.style.color = '#69bc37';
        } else {
            pass.style.color = '#ca5b53';
        };
    };
    //Read and validate input confirm pass
    confPass =(e)=> {
        var keyLog = e.currentTarget.value;
        var newPassKeyLog = this.refs.nPInp;
        var confirmPassword = this.refs.cPInp;
        if(keyLog == newPassKeyLog.value) {
            confirmPassword .style.color = '#69bc37';
            newPassKeyLog.style.color = '#69bc37';
        } else {
            confirmPassword .style.color = '#ca5b53';
            newPassKeyLog.style.color = '#ca5b53';
        };
    };
    //checkHash
    checkHash =(userHash,userSalt,pass)=> {
        //HeshPass func
        var hash = CryptoJS.HmacSHA1(pass,userSalt).toString(CryptoJS.enc.Hex);
        if (userHash == hash) return true
            else return false
    };
    //Check name availability
    checkName =(e)=> {
        e.preventDefault();
        var newUsername = this.refs.nUInp;
        var newName = newUsername.value;
        var oldUsername = this.state.user.username;
        if(this.regExpr(newName)) {
            this.setState({err: {message:'Don not use special characters in name!'}, modalWindow:true,});
            return; //alert('Don not use special characters in name');
        }
        if(oldUsername == newName) {
            this.setState({err: {message:'You Old name and new name is equal!'}, modalWindow:true,});
            return; //alert('You Old name and new name is equal.')
        };
        var data = 'newUsername=' + encodeURIComponent(newName);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/checkName',true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(data);
        xhr.onload =()=>  {
            //var Obj = JSON.parse(xhr.response);
            if (xhr.status === 200) {
                newUsername.style.color = '#69bc37';
                this.setState({ buffCkName: newName });
                this.setState({ newNameStatus: 'is free' });
            } else {
                newUsername.style.color = '#ca5b53';
                this.setState({ newNameStatus: 'is in use' });
            }
        };
        return false;
    };
    //Send new user data
    sendAuth =()=> {
        //e.preventDefault();
        var username = (this.refs.nUInp).value;
        var password = (this.refs.nPInp).value;
        var confPass = (this.refs.cPInp).value;
        var oldUsername = this.state.user.username;
        var oldPassword = (this.refs.oPInp).value;
        if(this.regExpr(username)) {
            this.setState({err: {message:'Don not use special characters in name!'}, modalWindow:true,});
            return; //alert('Don not use special characters in name!');
        }
        if(!username) {
            this.setState({err: {message:'You forgot type name, try one more!'}, modalWindow:true,});
            return; //alert('You forgot type name, try one more.');
        }
        if(!this.checkHash(this.state.user.hashedPassword,this.state.user.salt,oldPassword)) {
            this.setState({err: {message:'You Old passwords is not valid!'}, modalWindow:true,});
            return; //alert('You Old passwords is not valid.');
        }
        if (!password || !confPass) {
            this.setState({err: {message:'You forgot type new passwords, try one more! If you do not want change password retype old password in field "New Password" and "Confirm New Password"'}, modalWindow:true,});
            return; //alert('You forgot type passwords, try one more.');
        }
        if (password != confPass) {
            this.setState({err: {message:'Passwords not equal! Change passwords and try one more!'}, modalWindow:true,});
            return; //alert('Passwords not equal! Change passwords and try one more.');
        }
        console.log('oldUsername: ',oldUsername,',','newUsername: ',username,',','newPassword: ',password);
        var data = 'oldUsername='+ encodeURIComponent(oldUsername)
            + '&username=' + encodeURIComponent(username)
            +'&password=' + encodeURIComponent(password)
            +'&oldPassword='+ encodeURIComponent(oldPassword);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/changeUserData',true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(data);
        xhr.onload  = () => {
            if (xhr.readyState === xhr.DONE) {
                if (xhr.status === 200) {
                    this.setState({err: {message:'User data changed successful!'}, modalWindow:true,});
                    //alert('User data changed successful');
                    sessionStorage.setItem('user', xhr.response);
                    setTimeout(()=>{this.setState({ chatRedirect: true });},2000);

                } else {
                    //console.log('xhr.onload: ','err');
                    sessionStorage.setItem('error', xhr.response);
                    this.setState({ errorRedirect: true });
                }
            }
        };
        return false;
};
    //loadUserImg
    handleSetImg =(event)=>{
        console.log('handleSetImg: ',event.target)
        if(event.target.files.length > 1 ) {
            this.setState({err: {message:'More then 1 file selected!'}, modalWindow:true,});
            return;
        }

        this.setState({
            userImg: URL.createObjectURL(event.target.files[0]),
            userImgFile:event.target.files[0]
        },()=>console.log("imgSet: ",this.state));
    };

    uploadUserImg =()=>{
        //console.log("sendUserImg blob: ",this.state);
        let userImgFile = this.state.userImgFile;
        console.log("userImgFile: ",userImgFile);
        console.log("userImgFile.name: ",userImgFile.name);
        if(!userImgFile) return this.setState({err: {message:'User image did not selected!!'}, modalWindow:true,});
        const fd  = new FormData();
        fd.append('image',userImgFile,"userID_"+this.state.user._id);
        console.log("FormData: ",fd);
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/changeUserImg',true);
        xhr.send(fd);
        xhr.onload  = () => {
            console.log('uploadUserImg res: ',xhr);
            if (xhr.readyState === xhr.DONE) {
                if (xhr.status === 200) {
                    this.setState({err: {message:'User image changed successful!'}, modalWindow:true,});
                    sessionStorage.setItem('user', xhr.response);
                    setTimeout(()=>{this.setState({ chatRedirect: true });},2000);

                } else {
                    //console.log('xhr.onload: ','err');
                    sessionStorage.setItem('error', xhr.response);
                    this.setState({ errorRedirect: true });
                }
            }
        };
        return false;
    }

    render() {
        //console.log('/UP user: ',this.state.user);
        if(this.state.chatRedirect) {return <Redirect to='/chat'/>;};
        if(this.state.errorRedirect) {return <Redirect to='/error'/>};
        if(this.state.frontpageRedirect) {return <Redirect to='/'/>};
        return (
            <Page user={this.state.user} title="USER PAGE">

                {(this.state.modalWindow)?(
                    <Modal show={this.state.modalWindow} handleClose={this.hideModal} err={this.state.err}/>
                ):('')}

                {(this.state.PromptModalWindow)?(
                    <Prompt
                        promptHandler={this.promptHandler}
                        show={this.state.PromptModalWindow}
                        handleClose={this.hidePrompt}
                        name={"password"}
                        type={"password"}
                        placeholder={"password"}
                        message={this.state.promptMessage}/>
                ):('')}

                {(this.state.ConfirmModalWindow)?(
                    <Confirm confirmHandler={this.confirmHandler} show={this.state.ConfirmModalWindow} message={this.state.confirmMessage}/>
                ):('')}

                <form onSubmit={(ev)=>{
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.sendAuth();
                }} className="user-page" name="loginform" id="form">

                    <div className="form-group">
                        <div className="upload-img-block">
                                <div>
                                <label for="file-upload" class="custom-file-upload">
                                    {this.state.userImg ?
                                        <img id='userImg' src={this.state.userImg}/>
                                        :
                                        <span>Upload your image</span>
                                    }
                                </label>
                                < input type = "file" id="file-upload" onChange={this.handleSetImg}/>
                                </div>
                            {this.state.userImg ?
                                <div name="buttonform">
                                    <button onClick={this.uploadUserImg} className="btn" data-loading-text="Sending...">
                                        Save
                                    </button>
                                </div>
                                : ''
                            }
                        </div>

                    </div>

                    <div className="form-group">
                        <label htmlFor="input-username" className="control-label">New Name {(this.state.newNameStatus)?(this.state.newNameStatus):('')}</label>
                        <input onChange={this.ckReName} id="newUsername" name="username"   type="text" className="form-control"  defaultValue={this.state.user.username}  ref="nUInp"/>
                        <div name="buttonform" className="btn-check">
                            <button onClick={this.checkName} className="btn" data-loading-text="Sending...">CHECK</button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="input-password" className="control-label">Old Password</label>
                        <input onChange={this.ckPass} id="oldPassword" name="oldPassword"  type="password" className="form-control" placeholder="Password" ref="oPInp"/>
                    </div>

                    <div className="form-group">
                        <label htmlFor="input-password" className="control-label">New Password</label>
                        <input id="newPassword" name="password"  type="password" className="form-control"  placeholder="Password" ref="nPInp"/>
                    </div>

                    <div className="form-group">
                        <label htmlFor="input-password" className="control-label">Confirm New Password</label>
                        <input onChange={this.confPass} id="confirmPassword" name="confirmPassword"  type="password" className="form-control"  placeholder="Password" ref="cPInp"/>
                    </div>

                    <div className="form-group">
                        <div className="wrapper" >
                            <button id= "changeData" type="submit" className="btn" data-loading-text="Sending...">CONFIRM</button>
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="wrapper" >
                            <button onClick={(ev)=>{
                                ev.preventDefault();ev.stopPropagation();this.showPrompt("Confirm You Password:")}
                            } id= "deleteData" type="submit" className="btn" data-loading-text="Sending...">DELETE MY ACCOUNT</button>
                        </div>
                    </div>

                </form>


            </Page>
        )
    }
}


export default UserP;