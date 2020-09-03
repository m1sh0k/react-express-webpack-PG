import React from 'react';


class OnContextMenuBtns extends React.Component {

    constructor(props){
        super(props);
        this.state = {
        }
    }



    render() {
        console.log("OnContextMenuBtns props:",this.props);

        return (

            <div>
                <ul className="btnDropDown"  style={{top:this.props.contextMenuLocation.top-15, left:this.props.contextMenuLocation.left}} onMouseLeave={this.props.rightClickMenuOnHide}>
                    {this.props.btnList.map((name,i)=> <li key={i} onClick={()=> this.props.onContextMenuBtnsResponse(name)} className='dropDownBtn'>{name}</li>)}
                </ul>
            </div>
        )
    }
}

export default OnContextMenuBtns;