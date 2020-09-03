
const Sequelize = require('sequelize');
const config = require('../../config');
let pgConf = config.get('pg');
const sequelize = new Sequelize(pgConf.database,pgConf.username, pgConf.password, {
    host: 'localhost',
    dialect: 'postgres',
});

module.exports = sequelize;



