var crypto = require('crypto')
  , Blockr = require('./helpers/blockr-api')
  , mysql = require('./config.js')
  , s = require('speakeasy');

function createUserString() {
    var bytes = crypto.randomBytes(16).toString('hex');
    return bytes.slice(0, 7) +
        "-" + bytes.slice(8, 16) +
        "-" + bytes.slice(17, 24) +
        "-" + bytes.slice(25, 32);
}

function db_error(message) {
    if (message === void 0) { message = "There was a database error! Please contact an administrator immediately"}
    return {
        "error": {"type": "DB_ERROR", "message":message}
    };
}


var User = (function() {
    function User(req) {
        this.req = req;
    }
    User.prototype.read_user_settings = function(identifier, callback) {
        mysql.query('SELECT setting, value, shared_key FROM user_settings INNER JOIN users ON users.identifier = user_settings.identifier WHERE users.identifier = ?', [identifier], function(err, rows) {
            if(err) {
                console.log(err);
                callback(err);
            }
            var settings = {};
            if(rows.length > 0) {
                for(var row in rows) {
                    if(rows.hasOwnProperty(row)) {
                        settings[rows[row]['setting']] = rows[row]['value'];
                    }
                }
            }
            callback(false, settings)

        });
    };
    User.prototype.create = function(callback) {
        var identifier = createUserString();
        var data = {};
        var wallet = {
            identifier: identifier,
            shared_key: crypto.randomBytes(48).toString('hex'),
            wallet_data: "",
            created_at: Math.floor(new Date() / 1000),
            last_update: Math.floor(new Date() / 1000),
            created_ip_address: this.req.ip,
            last_ip_address: this.req.ip,
            email: ('email' in this.req.body) ? this.req.body.email : null
        };
        mysql.query('INSERT INTO users SET ?', wallet, function(err, rows) {
            if(err) {
                console.log(err);
                callback(db_error());
            }
            data.identifier = identifier;
            data.shared_key = wallet.shared_key;
            data.error = false;
            callback(data);
        });
    };
    User.prototype.genAuthKey = function(identifier, expires, callback) {
        var data = {
            identifier: identifier,
            expires: expires,
            user_agent: this.req.headers['user-agent'],
            auth_key: crypto.randomBytes(64).toString('hex')
        };
        mysql.query('INSERT INTO user_authkeys SET ?', data, function(err, rows) {
            if(err){
                callback(db_error());
            }
            callback(false, data.auth_key);
        });
    };
    User.prototype.tryGauth = function(identifier, token, is_trusted, callback) {
        var _this = this;
        this.read_user_settings(identifier,
            function(err, settings) {
                if(err){
                    console.log(err);
                    callback(db_error());
                }

                if('gauth_enabled' in settings && (settings['gauth_enabled'] == 'true')) {
                    var expected_key = s.totp({key: settings['gauth_secret'], encoding: 'base32'});

                    if(expected_key === token) {
                        // 1 week if trusted, 2 hours if not
                        var expiration_time = (is_trusted == "true")
                            ? Math.floor(new Date() / 1000) + (60 * 60 * 24 * 7)
                            : Math.floor(new Date() / 1000) + (60 * 60 * 2);
                            _this.genAuthKey(identifier, expiration_time, function(err, auth_key) {
                            if(err) {
                                callback(err);
                            }
                            callback({error: false, data: {auth_key: auth_key, expires: expiration_time}});
                        });
                    } else {
                        callback({error: {type: "WRONG_TOKEN", message: "The token you provided is wrong. " +
                        "You may need to try again in about 10 seconds because " +
                        "these tokens are time based"}});
                    }
                } else {
                    callback({error: {type: "NO_GAUTH", message: "Google Authenticator was not found for this identifier"}});
                }
            }
        );
    };
    User.prototype.setGauth = function(identifier, token, secret, shared_key, callback) {
        var _this = this;
        mysql.query('SELECT * FROM users WHERE identifier = ?', [identifier], function(err, rows) {
            if(rows.length > 0) {
                var row = rows[0];
                if(row.shared_key === shared_key) {
                    var expected_key = s.totp({key: secret, encoding: 'base32'});
                    if(token === expected_key) {
                        var q1 = "INSERT INTO user_settings (`identifier`, `setting`, `value`) VALUES (?, 'gauth_enabled', 'true') ON DUPLICATE KEY UPDATE `value` = 'true'; ";
                        var q2 = "INSERT INTO user_settings (`identifier`, `setting`, `value`) VALUES (?, 'gauth_secret', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);";
                        var combined = mysql.format(q1 + q2, [
                            identifier,
                            identifier,
                            secret
                        ]);

                        console.log(combined);
                        mysql.query(combined, function(err, rows) {
                            if(err) {
                                console.log(err);
                                callback(db_error())
                            }
                            var expires = Math.floor(new Date() / 1000) + (60 * 60 * 24 * 7);
                            _this.genAuthKey(identifier, expires, function(err, auth_key) {
                                if(err) {
                                    console.log(err);
                                    callback(db_error())
                                }
                                callback({error: false, data: {message: "successfully set token", auth_key: auth_key, expires: expires}});
                            });
                        });
                    } else {
                        callback({
                            error: {
                                type: "WRONG_TOKEN",
                                message: "The token you provided is wrong. " +
                                "You may need to try again in about 10 seconds because " +
                                "these tokens are time based"
                            }
                        });
                    }
                }
            }
        });
    };

    User.prototype.check2FA = function (res, identifier, callback, fail_callback) {
        var req = this.req;

        this.read_user_settings(identifier, function(err, settings) {
            if(err) {
                res.json(db_error());
            }
            if (('gauth_enabled' in settings) && settings.gauth_enabled === 'true') {
                console.log(req.cookies);
                if('auth_key' in req.cookies) {
                    console.log('in cookies');
                    mysql.query('SELECT * FROM user_authkeys WHERE identifier=? AND auth_key=?', [identifier, req.cookies.auth_key], function(err, rows) {
                        if(rows.length > 0) {
                            var row = rows[0];
                            if(parseInt(row.expires) < Math.floor(new Date() / 1000)) {
                                // 2FA enabled, but their authkey recently expired
                                if (fail_callback === void 0) {
                                    res.json(
                                        {
                                            error: {
                                                type: "AUTH_KEY_EXPIRED",
                                                message: "Your 2FA authentication token has expired. You'll need to login again using your 2FA Authenticator such as Google Authenticator."
                                            }
                                        }
                                    );
                                }else{
                                    fail_callback();
                                }

                            } else {
                                // 2FA enabled, and they're authorized
                                callback();
                            }
                        } else {
                            console.log('not in db');
                            // 2FA enabled, there's a cookie, but it's not in our DB
                            if (fail_callback === void 0) {
                                res.json({error: {type: "2FA_ENABLED", message: "2FA is enabled for this account, but you're not authenticated."}});
                            } else {
                                fail_callback();
                            }
                        }

                    });
                } else {
                    // 2FA enabled, but no cookie
                    if (fail_callback === void 0) {
                        res.json({error: {type: "2FA_ENABLED", message: "2FA is enabled for this account, but you're not authenticated."}});
                    } else {
                        fail_callback();
                    }

                }
            } else {
                // if they don't have 2FA enabled, we run the callback normally
                callback();
            }
        });
    };

    User.prototype.updateEmail = function(identifier, shared_key, email, callback) {
        mysql.query('SELECT * FROM users WHERE identifier = ?', [identifier], function(err, rows) {
            if(err) {
                callback(db_error());
            }
            if (rows.length > 0) {
                var row = rows[0];
                if (row.shared_key === shared_key) {
                    mysql.query('UPDATE users SET email = ? WHERE identifier = ?', [email, identifier], function(err, rows) {
                        if(err) {
                            callback(db_error());
                        } else {
                            callback({error: false})
                        }
                    });
                } else {
                    callback({error: {
                        "type": "INVALID_SHAREDKEY",
                        "message": "Fatal Error: Shared Key does not match wallet, update aborted"
                    }})
                }
            } else {
                callback({error: {
                    "type": "WALLET_NOT_FOUND",
                    "message": "There is no wallet with that identifier"
                    }
                })
            }
        });
    };

    User.prototype.readAccount = function(identifier, shared_key, callback) {
        mysql.query('SELECT * FROM users WHERE identifier = ?', [identifier], function(err, rows) {
            if(err) {
                callback(db_error());
            }
            if (rows.length > 0) {
                var row = rows[0];
                if (row.shared_key === shared_key) {
                    callback({error: false,
                        data:
                        {
                            email: rows[0].email
                        }
                    });
                } else {
                    callback({error: {
                        "type": "INVALID_SHAREDKEY",
                        "message": "Fatal Error: Shared Key does not match wallet, update aborted"
                    }})
                }
            } else {
                callback({error: {
                    "type": "WALLET_NOT_FOUND",
                    "message": "There is no wallet with that identifier"
                }
                })
            }
        });
    };

    return User;
})();

module.exports = User;