import React from 'react';
import Page from '../layout/page.js';


class FrontP extends React.Component {
    constructor (props) {
        var user = JSON.parse(sessionStorage.getItem('user'));
        super(props);
        this.state = {
            user: user
        };
    };

    render() {
        //var user = JSON.parse(sessionStorage.getItem('user'));
        //console.log('/FP user:',this.state.user);
        return (
            <Page user={this.state.user} title="Hello ≥︺‿︺≤">
                <div className="frontTitle">
                    <p className="logo">Hello ≥︺‿︺≤</p>
                    <div className="main">
                        <span className="stand"></span>
                        <div className="cat">
                            <div className="body"></div>
                            <div className="head">
                                <div className="ear"></div>
                                <div className="ear"></div>
                            </div>
                            <div className="face">
                                <div className="nose"></div>
                                <div className="whisker-container">
                                    <div className="whisker"></div>
                                    <div className="whisker"></div>
                                </div>
                                <div className="whisker-container">
                                    <div className="whisker"></div>
                                    <div className="whisker"></div>
                                </div>
                            </div>
                            <div className="tail-container">
                                <div className="tail">
                                    <div className="tail">
                                        <div className="tail">
                                            <div className="tail">
                                                <div className="tail">
                                                    <div className="tail">
                                                        <div className="tail"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>



            </Page>
        );
    }
}
export default  FrontP
