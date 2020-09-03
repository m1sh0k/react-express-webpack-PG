import React from 'react';
import Page from '../layout/page.js';

class errorPage extends React.Component {
    componentWillUnmount(){
        sessionStorage.removeItem('error');
    }

    render() {
        var user,error;
        if(JSON.parse(sessionStorage.getItem('user'))) user = JSON.parse(sessionStorage.getItem('user')).user;
        if(JSON.parse(sessionStorage.getItem('error')) || this.props.error || this.props.location.state.error) {
            error = JSON.parse(sessionStorage.getItem('error')) || this.props.error || this.props.location.state.error;
        } else {error={message:'Uuups! Maybe something wrong or you refresh error page.'}}

        //console.log('/EP err:', error);
        //console.log('/EP user', user);
        return (
            <Page user={user} title="ERROR happened!">
                {(error.status)?(<h1>ERROR:  {error.status} </h1>):('')}
                {(error.message)?(<p>MESSAGE: {error.message} </p>):('')}
            </Page>
        );
    }
}

export default errorPage;

