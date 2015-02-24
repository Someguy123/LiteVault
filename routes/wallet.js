var express = require('express');
var crypto = require('crypto');
var router = express.Router();
var Blockr = require('../helpers/blockr-api');
var mysql = require('../config.js');
var s = require('speakeasy');
var User = require('../user.js');

/**
 * inObject(obj, ... keys)
 *
 * Searches an object for the keys passed in as
 * additional parameters. Returns false if ANY
 * key is missing.
 *
 * Example:
 * > x = {id: 0, token: 123};
 * > inObject(x, 'id', 'token');
 * true
 *
 * @param obj
 * @returns {boolean}
 */
function inObject(obj) {
    var args = Array.prototype.slice.call(arguments, 1);
    var toFind = args.length;
    var totalFound = 0;
    for(var key in args) {
        if(args.hasOwnProperty(key)) {
            if(args[key] in obj) {
                totalFound = totalFound + 1;
            }
        }
    }
    return (totalFound === toFind);
}

/* GET home page. */
router.get('/', function(req, res) {
    res.render('wallet/index', { title: 'LiteVault Wallet' });
});

router.get('/create', function(req, res) {
    res.render('wallet/create', { title: 'LiteVault Register' });
});

router.get('/login', function(req, res) {
    res.render('wallet/login', { title: 'LiteVault Login' });
});
router.get('/forgot2fa', function(req, res) {
    res.render('wallet/forgot2fa', { title: 'LiteVault Forgot 2FA' });
});

function db_error(res, message) {
    if (message === void 0) { message = "There was a database error! Please contact an administrator immediately"}
    res.json({
        "error": {"type": "DB_ERROR", "message":message}
    });
}

router.post('/create', function(req, res) {
    (new User(req)).create(function(data) {
        res.json(data);
    });
});

// TODO: remove this debugging route
/*router.get('/list_all', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(wallets, null, "\t"));
});*/


router.get('/checkload/:identifier', function(req,res) {
    if(inObject(req.params, 'identifier')) {
        (new User(req)).read_user_settings(req.params.identifier, function(err, settings) {
            if(err) {
                db_error(res);
            }
            var output = {identifier: req.params.identifier};
            output.gauth_enabled = (('gauth_enabled' in settings) && settings.gauth_enabled === 'true');
            output.encryption_settings = ('encryption_settings' in settings) ? settings.encryption_settings : {algo: 'aes', iterations: 5};
            (new User(req)).check2FA(res, req.params.identifier, function () {
                output.auth_key_isvalid = true;
                res.json(output);
            }, function() {
                output.auth_key_isvalid = false;
                res.json(output);
            });
        });
    } else {
        res.json(res.json({error: {
            type: "INVALID_PARAM",
            message: "Missing required get parameters, required: " +
            "(identifier)"}}))
    }
});

router.get('/load/:identifier', function(req, res) {
    var data = {};
    // TODO: prevent brute forcing identifiers etc.
    (new User(req)).check2FA(res, req.params.identifier, function () {
        mysql.query('SELECT * FROM users WHERE identifier = ?', [req.params.identifier], function(err, rows) {
            if(err) {
                db_error(res);
            }
            console.log(rows);
            if(rows.length > 0) {
                var user = rows[0];
                data.error = false;
                data.wallet = user['wallet_data'];
            } else {
                data.error = {
                    "type": "WALLET_NOT_FOUND",
                    "message": "There is no wallet with that identifier"
                }
            }
            res.json(data);
        });
    });
});

router.post('/update', function(req, res) {
    var data = {};
    if(inObject(req.body, 'identifier')) {
        var identifier = req.body.identifier;
        // TODO: prevent brute forcing identifiers
        (new User(req)).check2FA(res, identifier, function () {
            mysql.query('SELECT * FROM users WHERE identifier = ?', [identifier], function (err, rows) {
                if (err) {
                    db_error(res);
                }
                console.log(rows);
                if (rows.length > 0) {
                    var user = rows[0];
                    if (user.shared_key == req.body.shared_key) {
                        data.error = false;
                        data.message = "Successfully updated wallet";
                        mysql.query('UPDATE users SET wallet_data = ?, last_update = ?, last_ip_address = ? WHERE identifier = ?', [req.body.wallet_data, Math.floor(new Date() / 1000), req.ip, identifier]);
                    } else {
                        data.error = {
                            "type": "INVALID_SHAREDKEY",
                            "message": "Fatal Error: Shared Key does not match wallet, update aborted"
                        }
                    }
                } else {
                    data.error = {
                        "type": "WALLET_NOT_FOUND",
                        "message": "There is no wallet with that identifier"
                    }
                }
                res.json(data);
            });
        });
    } else {
        res.json({error: {
            type: "INVALID_PARAM",
            message: "Missing required post parameters, required: (identifier)"}
        });
    }


});

/*
 * Begin Blockr Proxy URLs
 *
 * Because you can't make a cross domain JS
 * request, we need to set up proxy URLs for
 * the client to use.
 */
router.get('/getunspent/:addr', function(req, res) {
    var address = new Blockr.Address;
    res.setHeader('Content-Type', 'application/json');

    address.unspent(req.params.addr, function(data) {
        res.end(data);
    });
});

router.get('/getbalances/:addr', function(req, res) {
    var address = new Blockr.Address;
    res.setHeader('Content-Type', 'application/json');

    address.balances(req.params.addr, function(data) {
        res.end(data);
    });
});

router.post('/pushtx', function(req, res) {
    var TX = new Blockr.TX;
    res.setHeader('Content-Type', 'application/json');

    TX.push(req.body.hex, function(data) {
        res.end(data);
    });
});

router.get('/addresstxs/:addr', function(req, res) {
    var address = new Blockr.Address;
    res.setHeader('Content-Type', 'application/json');

    address.txs(req.params.addr, function(data) {
        res.end(data);
    });
});

router.post('/update_account', function(req, res) {
    if(inObject(req.body, 'identifier', 'email', 'shared_key')) {
        (new User(req)).check2FA(res, req.body.identifier, function () {
            (new User(req)).updateEmail(req.body.identifier, req.body.shared_key, req.body.email, function(data) {
                res.json(data);
            });
        });
    } else {
        res.json({error: {
            type: "INVALID_PARAM",
            message: "Missing required post parameters, required: " +
            "(identifier, email, shared_key)"}})
    }
});
router.post('/read_account', function(req, res) {
    if(inObject(req.body, 'identifier', 'shared_key')) {
        (new User(req)).check2FA(res, req.body.identifier, function () {
            (new User(req)).readAccount(req.body.identifier, req.body.shared_key, function(data) {
                res.json(data);
            });
        });
    } else {
        res.json({error: {
            type: "INVALID_PARAM",
            message: "Missing required post parameters, required: " +
            "(identifier, shared_key)"}})
    }
});


router.get('/gauth_create', function(req, res) {
    res.json({error:false, data: s.generate_key({length: 20, google_auth_qr: true, name: "LiteVault Wallet"})});
});

router.post('/gauth_create', function(req, res) {
    if(inObject(req.body, 'identifier', 'token', 'secret', 'shared_key')) {
        (new User(req)).check2FA(res, req.body.identifier, function () {
            (new User(req)).setGauth(req.body.identifier, req.body.token, req.body.secret, req.body.shared_key, function (data) {
                res.json(data);
            });
        });
    } else {
        res.json({error: {
            type: "INVALID_PARAM",
            message: "Missing required post parameters, required: " +
            "(identifier, token, secret, shared_key)"}})
    }
});

// TODO: Clean up callback hell here.

router.post('/gauth', function(req,res) {
    if(inObject(req.body, 'token', 'identifier', 'is_trusted')) {
        var identifier  = req.body.identifier
          , token       = req.body.token
          , is_trusted  = req.body.is_trusted;

        (new User(req)).tryGauth(identifier, token, is_trusted, function(data) {
            res.json(data);
        });
    } else {
        res.json({error: {
            type: "INVALID_PARAM",
            message: "Missing required post parameters, required: " +
            "(identifier, token, is_trusted)"}})
    }
});

router.get('/alerts', function(req, res) {
    mysql.query('SELECT * FROM alerts', function(err, rows) {
        if(err) {
            db_error();
        } else {
            res.json(rows);
        }
    });
});

router.post('/')

module.exports = router;
