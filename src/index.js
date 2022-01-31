import React from 'react'
import ReactDOM from 'react-dom';
import Login from './mainComp/login.js'
import Register from './mainComp/register.js'
import Error from './mainComp/error.js'
import Chat from './mainComp/chat.js'
import UserPage from './mainComp/userPage.js'
import UsersAdm from './mainComp/users.js'
import { BrowserRouter,Switch, Route, Redirect} from 'react-router-dom'
import '../public/css/app.css';
import FrontP from "./mainComp/frontpage";
import ResetPass from "./mainComp/resetPass"
import ChangePass from "./mainComp/changePass"
//import '../public/css/bootstrap/css/bootstrap.css';



//Check ? LogIn
function isLoggedIn() {
    //var user = JSON.parse(sessionStorage.getItem('user')).user;
    //console.log('/index checkOut user:',user);
    if (!JSON.parse(sessionStorage.getItem('user'))) {return false}
    else {return true}
}
//Check ? Admin
function isAdministrator() {
    if (!JSON.parse(sessionStorage.getItem('user'))) {return false}
    var user = JSON.parse(sessionStorage.getItem('user')).user;
    //console.log('/index Administrator: ',user);
    if (user.username === 'Administrator') {return true}
    else {return false}
}

function checkToken(props) {
    //do rest and check token and user id
    console.log("checkToken: ",props)
    let userId = props.match.params.userId;
    let token = props.match.params.token;
    return !userId && !token;
}

const Main = () => (
    <BrowserRouter>
        <Switch>
            <Route exact path="/" render={() => <FrontP/>} />
            <Route path="/register" render={() => isLoggedIn() ?
                <Error error={{message:'You are always login in. Press SIGN OUT to create new account',status:'403 Forbidden'}} />
                :
                <Register/>}
            />
            <Route path="/resetPass" render={() => isLoggedIn() ?
                <Error error={{message:'You are always login in. Go to MY PROFILE',status:'403 Forbidden'}} />
                :
                <ResetPass/>}
            />
            <Route path="/changePass/:token/:userId" render={(props) => checkToken(props) ?
                <Error error={{message:'Incorrect request',status:'403 Forbidden'}} />
                :
                <ChangePass
                    token={props.match.params.token}
                    userId={props.match.params.userId}
                />}
            />
            <Route path="/login" render={() => isLoggedIn() ? (
                <Error error={{message:'You are always login in. Press SIGN OUT to change account',status:'403 Forbidden'}} />)
                :
                <Login/>}
            />
            <Route path="/chat"  render={() => isLoggedIn() ?
                <Chat />
                :
                <Redirect to="/login"/>}
            />
            <Route path="/userPage" render={() => isLoggedIn() ?
                <UserPage />
                :
                <Redirect to="/login"/>}
            />
            <Route path="/users" render={() => isAdministrator() ?
                <UsersAdm />
                :
                <Redirect to="/login"/>}
            />
            <Route path="/error" component={Error}/>
            <Route path="*" render={(props) => (<Error error={{message:'We are sorry but the page you are looking for does not exist.',status:'404 page not found'}} />)} />
        </Switch>
    </BrowserRouter>
);

ReactDOM.render(<Main />,document.getElementById('root'));

if(module.hot) {module.hot.accept();}


