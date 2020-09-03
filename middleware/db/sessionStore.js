const pg = require('pg');
const session = require('express-session');
const pgSession = require('express-pg-session')(session);
const config = require('../../config');
const pgConf = config.get('pg');
var pgPool = new pg.Pool({
    max: 5,
    min: 0,
    idle: 10000
});
// let columnNames = {
//     session_id: '_id',
//     session_data: 'session',
//     expire: 'expires'
// };
var sessionStore = new pgSession({
    //pool : pgPool,                // Connection pool
    tableName : 'user_sessions',   // Use another table-name than the default "session" one
    //columns: columnNames,          // Alternate column names
    conObject:pgConf

});
//console.log("SS: ", sessionStore);
// sessionStore.prototype.load = function(sid) {
//   let session =
// };


module.exports = sessionStore;