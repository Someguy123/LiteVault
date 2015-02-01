var mysql      = require('mysql');
var connection = mysql.createConnection({
    host     : 'localhost',
    user     : '',
    password : '',
    database : 'litevault',
    multipleStatements: true
});

module.exports = connection;
