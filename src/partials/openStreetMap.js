import React from 'react';

class UserBtn extends React.Component {

    constructor(props){
        super(props);
        this.state = {

        }
    }

    componentDidMount(){

    }



    render() {
        //console.log('UserBtn props: ',this.props);
        //http://www.openstreetmap.org/?mlat=latitude&mlon=longitude&zoom=12
        //https://medium.com/@nargessmi87/how-to-embede-open-street-map-in-a-webpage-like-google-maps-8968fdad7fe4
        let latitude = this.props.latitude,
            longitude = this.props.longitude;
        let coorString = 'http://www.openstreetmap.org/?mlat='+latitude+'&mlon='+longitude+'&zoom=12';
        return (
            <div className="openStreetMap">

            </div>
        )
    }
}

export default UserBtn;
