import React from 'react';

class PromptWindow extends React.Component {
    constructor (props) {
        super(props);
        this.state = {

        };
    };
    handleChange =(evt)=> {
        //console.log('handleChange name: ',evt.target.name,',','val: ',evt.target.value);
        this.setState({ [evt.target.name]: evt.target.value });
    };


    render() {
        //console.log('Modal props: ',this.props);
        const showHideClassName = this.props.show ? 'modal display-block' : 'modal display-none';

        return (
            <div className={showHideClassName}>
                <section className='modal-main'>
                    <div className='modal-main-btnRight' onClick={this.props.handleClose}>X</div>
                    {(this.props.message)?(<p className="text-description">{this.props.message}</p>):('')}
                    <div className="form-group">
                        <label htmlFor={`input-${this.props.name}`} className="control-label">{this.props.name}</label>
                        <input
                            name={this.props.name}
                            type={this.props.type ? this.props.type:""}
                            className="form-control"
                            placeholder={this.props.placeholder ? this.props.placeholder:""}
                            onChange={this.handleChange}/>
                    </div>
                    {this.state[this.props.name] ? <p><button className='btn' onClick={()=>{this.props.promptHandler(this.state[this.props.name]);this.props.handleClose()}}>OK</button> </p> :""}
                </section>
            </div>

        )
    }
}

export default PromptWindow;