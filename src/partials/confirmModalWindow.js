import React from 'react';

class ConfirmWindow extends React.Component {

    render() {
        console.log('Confirm props: ',this.props);
        const handle = this.props.confirmHandler;
        const show = this.props.show;
        const showHideClassName = show ? 'modal display-block' : 'modal display-none';

        return (
            <div className={showHideClassName}>
                <section className='modal-main'>
                    {(this.props.message)?(<p className="text-description">{this.props.message} </p>):""}
                    <div className="modal-btn wrapper">
                        <button className=' btn' onClick={()=>handle(true)}>OK</button>
                        <button className=' btn' onClick={()=>handle(false)}>CANCEL</button>
                    </div>

                </section>
            </div>

        )
    }
}

export default ConfirmWindow;