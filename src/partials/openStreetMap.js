import React from 'react';
import Leaflet from 'leaflet';
import { Map, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
//https://leafletjs.com
//https://react-leaflet.js.org/en/
//https://codepen.io/PaulLeCam/pen/gzVmGw
//https://stackoverflow.com/questions/55009403/missing-leaflet-map-tiles-when-using-react-leaflet
//https://www.openstreetmap.org


Leaflet.Icon.Default.imagePath = '../node_modules/leaflet'

delete Leaflet.Icon.Default.prototype._getIconUrl;

Leaflet.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});


class UserMap extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            zoom: 13,
        }
    }
    render() {
        return (
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
        )
    }
}

export default UserMap;
