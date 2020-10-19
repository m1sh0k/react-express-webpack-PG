import React from 'react';
import { Map, TileLayer, Marker, Popup } from 'react-leaflet';

class UserMap extends React.Component {

    constructor(props){
        super(props);
        this.state = {
            zoom: 13,
        }
    }

    componentDidMount(){

    }



    render() {
        //console.log('UserBtn props: ',this.props);
        //http://www.openstreetmap.org/?mlat=latitude&mlon=longitude&zoom=12
        //https://medium.com/@nargessmi87/how-to-embede-open-street-map-in-a-webpage-like-google-maps-8968fdad7fe4
        //https://react-leaflet.js.org/docs/en/intro.html
        return (
            <div className="mapid">
                <Map center={this.props.location} zoom={this.state.zoom}>
                    <div className='modal-main-btnRight' onClick={this.props.handleClose}>X</div>
                    <TileLayer
                        attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    />
                    <Marker position={this.props.location}>
                        <Popup>
                            A pretty CSS3 popup. <br /> Easily customizable.
                        </Popup>
                    </Marker>
                </Map>
            </div>

        )
    }
}

export default UserMap;
