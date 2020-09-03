import React from 'react';
import Page from '../layout/page.js';
import {Redirect} from 'react-router-dom'
import ReactTable from "react-table";
import 'react-table/react-table.css'
import matchSorter from 'match-sorter'
import checkboxHOC from "react-table/lib/hoc/selectTable";

const CheckboxTable = checkboxHOC(ReactTable);



class UsersAdm extends React.Component {
    constructor (props) {
        var user = JSON.parse(sessionStorage.getItem('user')).user;
        super(props);
        this.state = {
            user: user,
            users: undefined,
            errorRedirect:false,
            selection: [],
            selectAll: false
        };
    };

    delUsers =(e)=> {
        e.preventDefault();
        var xhr = new XMLHttpRequest();
        var data = this.state.selection;
        if (data.length == 0) return alert('Nothing to deleting!');
        xhr.open('POST', '/users',true);
        xhr.setRequestHeader("Content-type", 'application/json');
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(JSON.stringify({usersArray: data}));
        xhr.onload = () => {
            if (xhr.readyState === xhr.DONE) {
                var response = JSON.parse(xhr.response);
                this.setState({selection: []});
                if (xhr.status === 200) {
                    //console.log('delUsers, res: ',response);
                    this.setState({users: response})
                }
                else {
                    //console.log('delUsers, err: ',response);
                    sessionStorage.setItem('error', xhr.response);
                    this.setState({ errorRedirect: true });
                }
            }
        };
        return false;
    };

    getUsers =(e)=> {
        e.preventDefault();
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/users',true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send();
        xhr.onload = () => {
            if (xhr.readyState === xhr.DONE) {
                var response = JSON.parse(xhr.response);
                if (xhr.status === 200) {
                    //console.log('xhr.onload users, res: ',response);
                    this.setState({users: response})
                }
                else {
                    //console.log('xhr.onload err: ',response);
                    sessionStorage.setItem('error', xhr.response);
                    this.setState({ errorRedirect: true });
                }
            }
        };
        return false;
    };

    toggleSelection = (key, shift, row) => {
        //console.log("toggleSelection key: ", key);
        /*
         Implementation of how to manage the selection state is up to the developer.
         This implementation uses an array stored in the component state.
         Other implementations could use object keys, a Javascript Set, or Redux... etc.
         */
        // start off with the existing state
        let selection = [...this.state.selection];
        const keyIndex = selection.indexOf(key);
        // check to see if the key exists
        if (keyIndex >= 0) {
            // it does exist so we will remove it using destructing
            selection = [
                ...selection.slice(0, keyIndex),
                ...selection.slice(keyIndex + 1)
            ];
        } else {
            // it does not exist so add it
            selection.push(key);
        }
        // update the state
        this.setState({ selection });
    };

    toggleAll = () => {
        /*
         'toggleAll' is a tricky concept with any filterable table
         do you just select ALL the records that are in your data?
         OR
         do you only select ALL the records that are in the current filtered data?

         The latter makes more sense because 'selection' is a visual thing for the user.
         This is especially true if you are going to implement a set of external functions
         that act on the selected information (you would not want to DELETE the wrong thing!).

         So, to that end, access to the internals of ReactTable are required to get what is
         currently visible in the table (either on the current page or any other page).

         The HOC provides a method call 'getWrappedInstance' to get a ref to the wrapped
         ReactTable and then get the internal state and the 'sortedData'.
         That can then be iterrated to get all the currently visible records and set
         the selection state.
         */
        const selectAll = this.state.selectAll ? false : true;
        const selection = [];
        if (selectAll) {
            // we need to get at the internals of ReactTable
            const wrappedInstance = this.checkboxTable.getWrappedInstance();
            // the 'sortedData' property contains the currently accessible records based on the filter and sort
            const currentRecords = wrappedInstance.getResolvedState().sortedData;
            // we just push all the IDs onto the selection array
            currentRecords.forEach(item => {
                selection.push(item._original._id);
            });
        }
        this.setState({ selectAll, selection });
    };

    isSelected = key => {
        /*
         Instead of passing our external selection state we provide an 'isSelected'
         callback and detect the selection state ourselves. This allows any implementation
         for selection (either an array, object keys, or even a Javascript Set object).
         */
        return this.state.selection.includes(key);
    };

    logSelection = () => {
        //console.log("selection:", this.state.selection);
    };

    render() {
        console.log('/UP users:',this.state);
        if(this.state.errorRedirect) {return <Redirect to='/error' />};

        const { toggleSelection, toggleAll, isSelected, logSelection, getUsers, delUsers } = this;

        const data = this.state.users;

        var columns = [
            {
                Header: 'Name:',
                filterable: true,
                //accessor: 'username',
                id: "username",
                accessor: d => d.username,
                filterMethod: (filter, rows) =>
                    matchSorter(rows, filter.value, { keys: ["username"] }),
                filterAll: true
            },
            {
                Header: 'ID:',
                accessor: '_id'
            },
            {
                Header: 'Created:',
                accessor: 'created'
            },

            {
                Header: 'Hash:',
                accessor: 'hashedPassword'
            },
            {
                Header: 'Salt:',
                accessor: 'salt'
            },


        ];

        const selectAll = this.state.selectAll;

        const checkboxProps = {
            selectAll,
            isSelected,
            toggleSelection,
            toggleAll,
            selectType: "checkbox",
            getTrProps: (s, r) => {
                if (!s || !r) return {};
                const selected = this.isSelected(r.original._id);
                return {
                    style: {
                        backgroundColor: selected ? "lightgreen" : "inherit"
                    }
                };
            }
        };
        return (
            <Page user={this.state.user} title="ADMIN PAGE">
                {(!data)?(
                    <div className="form-group">
                        <div className="wrapper" >
                            <button onClick={getUsers} className="btn" data-loading-text="Sending...">GET USERS</button>
                        </div>
                    </div>
                ):(
                    <div>
                        {/*<h1>USERS TABLE:</h1>*/}
                        <div className="form-group w100">
                            <div className="wrapper modal-btn" >
                                <button onClick={getUsers} className="btn" data-loading-text="Sending...">UPDATE TABLE</button>
                                <button onClick={delUsers} className="btn" >DELETE SELECTED FROM DB</button>
                            </div>
                        </div>
                        <CheckboxTable
                            ref={r => (this.checkboxTable = r)}
                            data={data}
                            columns={columns}
                            /*filterable
                             defaultFilterMethod={(filter, row) =>
                             String(row[filter.id]) === filter.value}*/
                            defaultPageSize={5}
                            className="-striped -highlight"
                            {...checkboxProps}
                        />
                    </div>
                )}
            </Page>

        );
    }
}
export default  UsersAdm