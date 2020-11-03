
const session = require('express-session');
const pgSession = require('express-pg-session')(session);
const config = require('../../config');
const pgConf = config.get('pg');

const sessionStore = new pgSession({
    //pool : pgPool,                // Connection pool
    tableName : 'user_sessions',   // Use another table-name than the default "session" one
    //columns: columnNames,          // Alternate column names
    conObject:pgConf

});
//console.log("SS: ", sessionStore);
module.exports = sessionStore;