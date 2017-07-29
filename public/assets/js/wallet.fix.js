///<reference path="def/jquery/jquery.d.ts" />
///<reference path="def/jquery.cookie/jquery.cookie.d.ts" />
///<reference path="def/cryptojs/cryptojs.d.ts" />
///<reference path="def/bootstrap/bootstrap.d.ts" />
///<reference path="def/handlebars/handlebars.d.ts" />
/*
 * lib/wallet.ts
 *
 * This is the core of the LiteVault, all of this Typescript
 * and/or related javascript is held under the AGPL Licence
 * unless otherwise noted on the Git repository
 *
 * Created by Someguy123 (http://someguy123.com)
 */
var Wallet = (function () {
    function Wallet(identifier, password) {
        this.addresses = {};
        this.balances = {};
        this.is2Factor = false;
        this.saveListeners = [];
        this.addAddressListeners = [];
        this.balanceChangeListeners = [];
        this.transactionPushedListeners = [];
        this.delAddressListeners = [];
        this.coin_network = Bitcoin.networks.litecoin;
        this.CryptoConfig = {
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Iso10126,
            iterations: 5
        };
        this.identifier = identifier;
        this.password = password;
    }
    /**
     * setSharedKey()
     *
     * This is used when the wallet is first created, we get the shared key
     * from the server, we give it to this wallet object using this function
     * because we haven't yet written the encrypted wallet to the server
     * which contains the shared key.
     *
     * @param sKey
     */
    Wallet.prototype.setSharedKey = function (sKey) {
        this.shared_key = sKey;
    };
    Wallet.prototype.mark2FA = function () {
        this.is2Factor = true;
    };
    Wallet.prototype.generateAddress = function () {
        var key = Bitcoin.ECKey.makeRandom();
        var PubKey = key.pub.getAddress(this.coin_network).toString();
        var PrivKey = key.toWIF(this.coin_network);
        this.addAddress(PubKey, { label: "", priv: PrivKey });
        this.refreshBalances();
        this.store();
    };
    Wallet.prototype.addAddress = function (address, data) {
        if (address in this.addresses) {
            alert("Warning: address " + address + " already exists, skipping.");
        }
        else {
            this.addresses[address] = data;
            this.callAddAddressListeners(address, data);
        }
    };
    // Important: Make sure you try catch this
    Wallet.prototype.addAddressFromWIF = function (WIF) {
        var address = Bitcoin.ECKey.fromWIF(WIF);
        var pubkey = address.pub.getAddress(this.coin_network).toString();
        this.addAddress(pubkey, { priv: WIF, label: "" });
        this.refreshBalances();
        this.store();
    };
    Wallet.prototype.addAddresses = function (addresses) {
        for (var key in addresses) {
            this.addAddress(key, addresses[key]);
            console.log(key + " : " + JSON.stringify(addresses[key]));
        }
        this.refreshBalances();
        this.store();
    };
    Wallet.prototype.load = function (_success) {
        if (_success === void 0) { _success = function () {
        }; }
        var _this = this;
        $.get('/wallet/load/' + this.identifier, function (data) {
            if (data.error !== false) {
                alert(data.error.message);
            }
            else {
                var decWallet, decWalletString, decWalletJSON;
                //console.log("Decrypting data: '" + data.wallet + "' with password " + _this.password);
                console.log('Decrypting wallet');
                try {
                    // Decrypt wallet
                    decWallet = CryptoJS.AES.decrypt(data.wallet, _this.password, _this.CryptoConfig);
                    decWalletString = decWallet.toString(CryptoJS.enc.Utf8);
                    // Load the JSON, then use it to initialize the wallet
                    decWalletJSON = JSON.parse(decWalletString);
                    _this.setSharedKey(decWalletJSON.shared_key);
                    _this.addresses = decWalletJSON.addresses;
                    console.log('Wallet loaded successfully. Refreshing balances and running success callback.');
                    try {
                        _this.refreshBalances();
                        // run the success callback
                        _success();
                    }
                    catch (ex) {
                        alert("There was an error rendering this page. Please contact an administrator.");
                        console.log(ex);
                    }
                }
                catch (ex) {
                    alert("Error decrypting wallet - Invalid password?");
                    console.log(ex);
                }
            }
        }, "json").fail(function () {
            alert("Error loading wallet from server. Possible connection problems");
        });
    };
    Wallet.prototype.store = function () {
        var walletData = this.wallet_serialize();
        console.log("Encrypting data");
        encWalletData = CryptoJS.AES.encrypt(walletData, this.password, this.CryptoConfig);
        encWalletDataCipher = encWalletData.toString();
        var _this = this;
        $.post("/wallet/update", { identifier: this.identifier, shared_key: this.shared_key, wallet_data: encWalletDataCipher }, function (data) {
            if (data.error !== false) {
                alert(data.error.message);
                alert('WARNING: There was an error saving your wallet. ' + 'If you have created new addresses in the past few minutes, ' + 'please save their private keys ASAP, as your encrypted wallet' + ' may not have been updated properly on our servers.');
            }
            else {
                _this.callSaveListeners();
            }
        }, "json").fail(function () {
            alert('WARNING: There was an error saving your wallet. ' + 'If you have created new addresses in the past few minutes, ' + 'please save their private keys ASAP, as your encrypted wallet' + ' may not have been updated properly on our servers.');
        });
    };
    /**
     * refreshBalances(callback)
     *
     * Updates balances from server, then outputs the balance map
     * to the callback function.
     *
     * @param callback(balances)
     */
    /*
    Wallet.prototype.refreshBalances = function (callback) {
        if (callback === void 0) { callback = function (balances) {
        }; }
        var addrstring = Object.keys(this.addresses).join();
        var _this = this;
        // no addresses, no point loading balances
        if (addrstring == "") {
            callback({});
            return;
        }
        $.get('https://ltc.blockr.io/api/v1/address/balance/' + addrstring + '?confirmations=0', function (data) {
            if (data.status == "success") {
                // clear balance array
                _this.balances = {};
                // If you supply multiple addresses, then it's an array
                // not an object; Thanks Blockr for the inconsistency...
                if (Array.isArray(data.data)) {
                    for (var v in data.data) {
                        var addr_data = data.data[v];
                        _this.setBalance(addr_data['address'], addr_data['balance']);
                    }
                }
                else {
                    _this.setBalance(data.data['address'], data.data['balance']);
                }
                callback(this.balances);
            }
            else {
                alert('Uh oh, something went wrong calculating your balances');
            }
        }, "json");
    };
    */

    Wallet.prototype.refreshBalances = function (callback) {
        if (callback === void 0) { callback = function (balances) {}; }
  var _this = this;
  for(var v in this.addresses) {
    var v;
    (function(addr) {
      $.get('https://insight.litecore.io/api/addr/{addr}/balance'.replace('{addr}',addr))
      .then(function(data) {
        var bal = parseInt(data);
        bal = bal / 10e7;
        _this.setBalance(addr, bal);
        callback(_this.balances); 
      })
    })(v);
        }
    };
    Wallet.prototype.getUnspent = function (address, callback) {
//        $.get('/wallet/getunspent/' + address, function (data) {
        $.get('https://insight.litecore.io/api/addr/'+address+'/utxo', function (data) {            
      var unspent = data.map( function(utxo){
        return {
          "tx": utxo.txid,
            "amount": utxo.amount,
            "n": utxo.vout,
            "confirmations": utxo.confirmations,
            "script": utxo.scriptPubKey
        }
      })

      console.log(unspent);

            callback(unspent);
        }, "json");
    };
    /**
     * calculateBestUnspent()
     *
     * Sorts passed in unspents by confirmations descending.
     *
     * Returns an object containing the required unspents to match the
     * amount requested, as well as the total Litecoin value of them.
     *
     * @param amount (amount of coins to reach)
     * @param unspents (array of Unspent Transactions)
     * @returns {{unspent: Array<UnspentTX>, total: number}}
     */
    Wallet.prototype.calculateBestUnspent = function (amount, unspents) {
        // note: unspents = [ {tx, amount, n, confirmations, script}, ... ]
        // TODO: implement a real algorithm to determine the best unspents
        // e.g. compare the size to the confirmations so that larger coins
        // are used, as well as ones with the highest confirmations.
        // NOTE: cellvia added logic if both are confirmed, use larger amount
        unspents.sort(function (a, b) {
            if (a.confirmations && b.confirmations && a.amount > b.amount){
              return -1;
            }
            if (a.confirmations && b.confirmations && a.amount < b.amount){
              return 1;
            }
            if (a.confirmations > b.confirmations) {
                return -1;
            }
            if (a.confirmations < b.confirmations) {
                return 1;
            }
            return 0;
        });
        var CutUnspent = [], CurrentAmount = 0;
        for (var v in unspents) {
            CurrentAmount += parseFloat(unspents[v].amount);
            CutUnspent.push(unspents[v]);
            if (CurrentAmount >= amount) {
                break;
            }
        }
        if (CurrentAmount < amount) {
            throw "Not enough coins in unspents to reach target amount";
        }
        return { unspent: CutUnspent, total: CurrentAmount };
    };
    Wallet.prototype.validateKey = function (key, priv) {
        if (priv === void 0) { priv = false; }
        try {
            var version;
            var decoded = Bitcoin.base58check.decode(key);
            // are we validating a private key?
            if (priv === true) {
                version = this.coin_network.wif;
            }
            else {
                version = this.coin_network.pubKeyHash;
    // Temporary fix for multi-sig
    //if(decoded[0] == 5) {
    //  return true;
    //}
    if(decoded[0] == 50) {
      return true;
    }
            }
            // is this address for the right network?
            return (decoded[0] == version);
        }
        catch (ex) {
            // exceptions mean invalid address
            return false;
        }
    };
    Wallet.prototype.sortTransactions = function (transactions) {
        var allTransactions = [];

        for (var v in transactions) {
          var t = transactions[v];
          var address;
          if(t.vout.length === 1 ){
            address = t.vout[0].scriptPubKey.addresses[0];
          }else if( t.vout.length === 2 ){
            address = (+t.vout[0].value) > (+t.vout[1].value) ? t.vout[0].scriptPubKey.addresses[0] : t.vout[1].scriptPubKey.addresses[0];
          }else{
            console.log("unable to determine address from transaction.vout:"+t.vout);
          }

          var newTx = {
            time_utc: (t.time-1)*1000,
            address: address,
            amount: t.valueOut,
            confirmations: t.confirmations,
            tx: t.txid
          }
          allTransactions.push(newTx);
        }
        return allTransactions;
    };
    Wallet.prototype.getTransactions = function (callback) {
        var _this = this;
        var addys = Object.keys(this.addresses)
        if(!addys.length) return
//        $.get('https://ltc.blockr.io/api/v1/address/txs/' + Object.keys(this.addresses).join() + '?confirmations=0',  function (data) {
        $.get('https://insight.litecore.io/api/addrs/'+addys.join(",")+"/txs",  function (data) {
            data && data.items && data.items.length && callback(_this.sortTransactions(data.items));
        }, "json");
    };
    Wallet.prototype.sendCoins = function (fromAddress, toAddress, amount) {
        var _this = this;
        if (this.validateKey(toAddress) && this.validateKey(fromAddress)) {
            if (fromAddress in this.addresses && this.validateKey(this.addresses[fromAddress].priv, true)) {
                this.refreshBalances();
                if (this.balances[fromAddress] < amount) {
                    alert("You don't have enough coins to do that");
                    return;
                }
                this.getUnspent(fromAddress, function (data) {
                    data = _this.calculateBestUnspent(amount, data);
                    console.log(data);
                    // temporary constant
                    var minFeePerKb = 100000;
                    var tx = new Bitcoin.Transaction();
                    // IMPORTANT! We're dealing with Satoshis now
                    var totalUnspent = parseInt((data.total * Math.pow(10, 8)).toString());
                    amount = parseInt((amount * Math.pow(10, 8)).toString());
                    if (amount < minFeePerKb) {
                        alert("You must send at least 0.001 LTC (otherwise your transaction may get rejected)");
                        return;
                    }
                    console.log('Sending ' + amount + ' satoshis from ' + fromAddress + ' to ' + toAddress + ' unspent amt: ' + totalUnspent);
                    var unspents = data.unspent;
                    for (var v in unspents) {
                        tx.addInput(unspents[v].tx, unspents[v].n);
                    }
                    tx.addOutput(toAddress, amount);
                    console.log(tx);
                    var estimatedFee = _this.coin_network.estimateFee(tx);
                    if (estimatedFee > 0) {
                        // Temporary fix for "stuck" transactions
                        estimatedFee = estimatedFee * 3;
                    }
                    if ((amount + estimatedFee) > totalUnspent) {
                        alert("Can't fit fee of " + estimatedFee / Math.pow(10, 8) + " - lower your sending amount");
                        console.log('WARNING: Total is greater than total unspent: %s - Actual Fee: %s', totalUnspent, estimatedFee);
                        return;
                    }
                    var changeValue = parseInt((totalUnspent - amount - estimatedFee).toString());
                    // only give change if it's bigger than the minimum fee
                    if (changeValue >= minFeePerKb) {
                        tx.addOutput(fromAddress, changeValue);
                    }
                    tx.ins.forEach(function (input, index) {
                        tx.sign(index, new Bitcoin.ECKey.fromWIF(_this.addresses[fromAddress].priv));
                    });
                    console.log('Sending amount %s to address %s - Change value: %s - Fee in satoshis: %s - Fee in standard: %s', amount / Math.pow(10, 8), toAddress, changeValue / Math.pow(10, 8), estimatedFee, (estimatedFee / Math.pow(10, 8)));
                    var rawHex = tx.toHex();
                    console.log(rawHex);
                    _this.pushTX(rawHex, function () {
                        try {
                            beep(300, 4);
                        }
                        catch (e) {
                            console.error('Beep is not supported by this browser???');
                        }
                    });
                });
                this.refreshBalances();
            }
            else {
                alert("Error: You don't own that address!");
            }
        }
        else {
            alert('Error: Your sending or recipient address is invalid. Please check for any typos');
        }
    };
    Wallet.prototype.pushTX = function (tx, callback) {
        if (callback === void 0) { callback = function (data) {
        }; }
        var _this = this;
        $.post('/wallet/pushtx', { hex: tx }, function (data) {
            if (data.status !== "success") {
                alert('There was an error pushing your transaction. May be a temporary problem, please try again later.');
            }
            else {
                callback(data);
                _this.callTransactionPushedListeners(data);
            }
            _this.refreshBalances();
        }, "json").fail(function () {
            alert('There was an error pushing your transaction. May be a temporary problem, please try again later.');
        });
    };
    Wallet.prototype.setBalance = function (address, balance) {
        this.balances[address] = balance;
        this.callBalanceChangeListeners(this.balances);
    };
    /**
     * getTotalBalance()
     *
     * This function returns the total balance calculated
     * from this.balances; NOTE: It does NOT update the balance
     * from the server, if you need that, do this.refreshBalances();
     * before executing this function to get an up to date result.
     *
     * ~~Someguy123
     */
    Wallet.prototype.getTotalBalance = function () {
        var total = 0;
        for (var v in this.balances) {
            total += parseFloat(this.balances[v].toString());
        }
        return total;
    };
    Wallet.prototype.removeAddress = function (address) {
        delete this.addresses[address];
        this.refreshBalances();
        this.store();
        this.callDelAddressListeners(address);
    };
    Wallet.prototype.signMessage = function (address, message) {
        var privkey = new Bitcoin.ECKey.fromWIF(this.addresses[address].priv), signed_message = Bitcoin.Message.sign(privkey, message, this.coin_network);
        return signed_message.toString('base64');
    };
    /**
     * wallet_serialize()
     *
     * Returns the JSON version of the wallet, including
     * only the necessities, such as the shared key,
     * addresses, labels, and private keys
     *
     * @param prettify
     * @returns {string}
     */
    Wallet.prototype.wallet_serialize = function (prettify) {
        if (prettify === void 0) { prettify = false; }
        var walletdata = ({
            shared_key: this.shared_key,
            addresses: this.addresses
        });
        if (prettify) {
            return JSON.stringify(walletdata, null, "\t");
        }
        else {
            return JSON.stringify(walletdata);
        }
    };
    /*
     * Below are the "listeners", these functions register external
     * functions into listener arrays that are called when certain
     * events happen, such as saving, balance changes, and
     * new addresses being added.
     *
     * Their primary purpose is to allow us to register user interface
     * modifying code from outside of the class, to avoid polluting
     * our functions with code that is bound to the HTML/CSS
     *
     * A listener has two functions, the "call" which is ran when the
     * event happens, sometimes taking parameters, such as the
     * new updated balances; and also has a "register", which is called
     * by outside of the class to register new listener functions.
     *
     * ~~Someguy123
     */
    Wallet.prototype.callSaveListeners = function () {
        this.saveListeners.forEach(function (v, k) {
            v();
        });
    };
    Wallet.prototype.registerSaveListener = function (fn) {
        this.saveListeners.push(fn);
    };
    Wallet.prototype.callTransactionPushedListeners = function (data) {
        this.transactionPushedListeners.forEach(function (v, k) {
            v(data);
        });
    };
    Wallet.prototype.registerTransactionPushedListener = function (fn) {
        this.transactionPushedListeners.push(fn);
    };
    Wallet.prototype.registerAddAddressListener = function (fn) {
        this.addAddressListeners.push(fn);
    };
    Wallet.prototype.callAddAddressListeners = function (address, data) {
        this.addAddressListeners.forEach(function (v, k) {
            v(address, data);
        });
    };
    Wallet.prototype.registerDelAddressListener = function (fn) {
        this.delAddressListeners.push(fn);
    };
    Wallet.prototype.callDelAddressListeners = function (address) {
        this.delAddressListeners.forEach(function (v, k) {
            v(address);
        });
    };
    Wallet.prototype.registerBalanceChangeListener = function (fn) {
        this.balanceChangeListeners.push(fn);
    };
    Wallet.prototype.callBalanceChangeListeners = function (balances) {
        this.balanceChangeListeners.forEach(function (v, k) {
            v(balances);
        });
    };
    return Wallet;
})();

var data, encWalletData // TODO: Remove, it's here for debugging
,
encWalletDataCipher // TODO: Remove, it's here for debugging
,
wallet;

function renderTransactions() {
  if (Object.keys(wallet.addresses).length > 0) {
    wallet.getTransactions(function(data) {
      $('#list-transactions').html(Handlebars.templates['transactions']({
        transactions: data
      }));
    });
  } else {
    $('#list-transactions').html("");
  }
}

function makeColor(chars) {
  chars = parseInt(chars, 22.5) % 12 * 30;
  return '<div style="background-color: hsl(' + chars + ', 95%, 45%);"></div>';
}

function colorTag(address) {
  var hash = CryptoJS.MD5(address).toString(),
    tags = '<div class="colortag">';
  for (var i = 0; i < 3; i++) {
    var size = 2;
    tags += makeColor(hash.substring((i * size) + size, i * size));
  }
  tags += '</div>';
  return tags;
}

function initializeWallet(wallet) {
  wallet.load(function() {
    $('.ltc-balance').html('0 LTC');
    pulseAlerts();
    setInterval(pulseAlerts, 30000);
    // update balance every 10 seconds
    setInterval(function() {
      wallet.refreshBalances();
    }, 10000);
    setInterval(function() {
      renderTransactions();
    }, 30000);
    // shows "wallet saved" in top right corner when save events happen
    wallet.registerSaveListener(flashWalletSaved);
    wallet.registerAddAddressListener(function(a, b) {
      console.log('address listener called');
      console.log(a);
      console.log(b);
      $('#list-addresses').html(Handlebars.templates['addresses']({
        addresses: wallet.addresses
      }));
      renderAddresses();
    });
    wallet.registerBalanceChangeListener(function(balances) {
      $('.ltc-balance').html(wallet.getTotalBalance().toFixed(5));
      renderAddresses();
    });
    wallet.registerDelAddressListener(function(address) {
      renderAddresses();
    });
    wallet.registerTransactionPushedListener(function(data) {
      console.log(data);
      $('#txModalTXID').html(data.data);
      $('#txModal').modal('toggle');
      renderTransactions();
    });
    $('.wallet-container').html(Handlebars.templates['wallet']);
    if (wallet.is2Factor) {
      $('#2fa-status').css({
        color: 'green'
      });
      $('#2fa-status').html('Enabled');
    }
    renderTransactions();
    $('#list-addresses').html(Handlebars.templates['addresses']({
      addresses: wallet.addresses
    }));
    // now that the button actually exists, we register the click event
    $('#generate-btn').click(function() {
      wallet.generateAddress();
    });
    $('#import-btn').click(function() {
      try {
        wallet.addAddressFromWIF($('#import-address').val());
      } catch (ex) {
        alert("Error importing WIF. Please verify that the format is correct");
      }
    });
    $('#import-address').keypress(function(e) {
      if (e.which == 13) {
        $('#import-btn').click();
      }
    });
    $('#list-addresses').on("click", ".deleteaddr-btn", function() {
      var theAddress = this.parentElement.parentElement.attributes['data-address'].value;
      $('#deletingAddress').html(theAddress);
      $('#deleteAddressModal').modal('toggle');
    });
    $('#i-am-sure-delete').click(function() {
      wallet.removeAddress($('#deletingAddress').html());
      for (var v in $('#list-addresses').children()) {
        // silence typescript
        var row = $('#list-addresses').children()[v];
        var address = row.attributes['data-address'].value;
        if (address == $('#deletingAddress').html()) {
          row.remove();
        }
      }
    });
    $('#list-addresses .viewkey-btn').click(function() {
      var address = $(this).parent().parent().attr('data-address');
      var privkey = wallet.addresses[address].priv;
      $('#privkey-showtext').val(privkey);
      $('#privkeyModal').modal('toggle');
    });
    $('#list-addresses .signkey-btn').click(function() {
      var address = $(this).parent().parent().attr('data-address');
      $('#signmessage-address').html(address);
      $('#signMessageModal').modal('toggle');
    });
    $('#list-addresses .qr-btn').click(function() {
      var address = $(this).parent().parent().attr('data-address');
      $('#qrcode-img').attr('src', 'https://someguy123.com/coinwidget/qr/?address=litecoin:' + address);
      $('#qrcode-address').html(address);
      $('#qrcodeModal').modal('toggle');
    });
    $('#sign-message-btn').click(function() {
      var address = $('#signmessage-address').html();
      var message = $('#sign-message').val();
      $('#signed-message').html(wallet.signMessage(address, message));
    });
    // clear the signed messages when closed
    $('#signMessageModal').on('hidden.bs.modal', function(e) {
      $('#signmessage-address').html("");
      $('#sign-message').val("");
      $('#signed-message').html("");
    });
    $('#export-wallet-json-link').click(function() {
      $('#wallet-exported-txt').html(wallet.wallet_serialize(true));
      $('#exportWalletModal').modal('toggle');
    });
    $('#send-coins-btn').click(function() {
      var fromAddress = $('#select-my-addresses').val();
      var toAddress = $('#to-address').val();
      var amount = $('#send-coins-amount').val();
      wallet.sendCoins(fromAddress, toAddress, amount);
    });
    $('#configure-gauth').click(function() {
      $.get('/wallet/gauth_create', function(data) {
        $('#modal-gauth-qr').html('<img src="' + data.data.google_auth_qr + '" />');
        $('#modal-gauth-secret').html(data.data.base32);
        $('#configGauthModal').modal('toggle');
      }, "json");
    });
    $('#confirm-setup-2fa').click(function() {
      $.post('/wallet/gauth_create', {
        identifier: wallet.identifier,
        token: $('#modal-gauth-token').val(),
        secret: $('#modal-gauth-secret').html(),
        shared_key: wallet.shared_key
      }, function(data) {
        console.log(data);
        if (data.error) {
          if ('message' in data.error) {
            alert(data.error.message);
          } else {
            alert('Unknown Error');
          }
        } else {
          $.cookie('auth_key', data.data.auth_key);
          $('#configGauthModal').modal('toggle');
          $('#completeGauthModal').modal('toggle');
          $('#2fa-status').css({
            color: 'green'
          });
          $('#2fa-status').html('Enabled');
        }
      }, 'json');
    });
    $('#modal-gauth-token').keypress(function(e) {
      if (e.which == 13) {
        $('#confirm-setup-2fa').click();
      }
    });
    $.post('/wallet/read_account', {
      identifier: wallet.identifier,
      shared_key: wallet.shared_key
    }, function(data) {
      if (data.error) {
        alert(data.error.message);
      } else {
        $('#account-email').val(data.data.email);
      }
    }, "json");
    $('#save-email').click(function() {
      var email = $('#account-email').val();
      var post_data = (email != "") ? {
        email: email,
        identifier: wallet.identifier,
        shared_key: wallet.shared_key
      } : {
        email: "",
        identifier: wallet.identifier,
        shared_key: wallet.shared_key
      };
      $.post('/wallet/update_account', post_data, function(data) {
        if (data.error) {
          alert(data.error.message);
        } else {
          alert('Email Updated. If you left the field blank, we removed your email.');
        }
      }, "json");
    });
    document.title = "Litevault Wallet";
  });
}

function pulseAlerts() {
  $.get('/wallet/alerts', function(data) {
    var messages = "";
    for (var a in data) {
      messages += '<div class="alert ' + data[a]['alert-class'] + '">' + data[a]['alert'] + '</div>';
    }
    $('#alerts-section').html(messages);
  }, "json");
}
$('#authenticator-token').keypress(function(e) {
  if (e.which == 13) {
    $('#authenticator-btn').click();
  }
});
// Once they've registered and closed the modal,
// we redirect them to the login page
$('#registeredModal').on('hidden.bs.modal', function(e) {
  document.location.href = "/wallet/login";
});
$('#register-btn').click(function() {
  var password = $('#password-txt').val();
  var password_confirm = $('#password-txt-confirm').val();
  if (password !== password_confirm) {
    alert('Password doesn\'t match');
  } else {
    $.post('/wallet/create', ($('#email-txt').val() != "") ? {
      email: $('#email-txt').val()
    } : null, function(data) {
      console.log('Received data from creation server:');
      console.log(data);
      if (data.error === false) {
        wallet = new Wallet(data.identifier, password);
        wallet.setSharedKey(data.shared_key);
        wallet.store();
        console.log('Successfully created wallet');
        $.cookie('identifier', data.identifier);
        $('#reg-identifier').html(data.identifier);
        $('#registeredModal').modal('toggle');
      } else {
        alert("Uh oh! There was an error creating your wallet.");
      }
    }, "json");
  }
});
var flashWalletSaved = function() {
  $('#walletsaved').show();
  setTimeout(function() {
    $('#walletsaved').hide();
  }, 3000);
};

function renderAddresses() {
  var myAddr = $('#select-my-addresses');
  for (var v in wallet.balances) {
    var cld = myAddr.children('[value="' + v + '"]');
    if (cld.length > 0) {
      cld[0].innerHTML = v + " (" + wallet.balances[v] + " LTC)";
    } else {
      myAddr.append('<option value="' + v + '">' + v + " (" + wallet.balances[v] + " LTC)</option>");
    }
    // update balance in the address table
    balance = $('tr[data-address=' + v + ']');
    if (balance.length > 0) {
      balance = balance[0].children[1];
      balance.innerHTML = wallet.balances[v];
    }
  }
}
$('#login-btn').click(function() {
  var identifier = $('#identifier-txt').val(),
    password = $('#password-txt').val();
  $.cookie('identifier', identifier);
  wallet = new Wallet(identifier, password);
  $.get('/wallet/checkload/' + identifier, function(data) {
    if (data.error) {
      alert('error loading wallet: ' + data.error.message);
    } else {
      console.log(data);
      if (data.gauth_enabled) {
        wallet.mark2FA();
      }
      // note: if 2FA is disabled, this will also be true
      if (data.auth_key_isvalid === true) {
        initializeWallet(wallet);
      } else {
        $('#authenticatorModal').modal('toggle');
        $('#authenticator-btn').click(function() {
          $.post('/wallet/gauth', {
            identifier: identifier,
            token: $('#authenticator-token').val(),
            is_trusted: $('#is-trusted-chk').is(':checked').toString()
          }, function(data) {
            if (data.error) {
              alert(data.error.message);
            } else {
              console.log(data);
              console.log('setting cookie auth_key to ', data.data.auth_key);
              $.cookie('auth_key', data.data.auth_key, {
                expires: new Date(data.data.expires * 1000)
              });
              $('#authenticatorModal').modal('toggle');
              initializeWallet(wallet);
            }
          }, "json").fail(function() {
            alert('There was an error trying to authorize you. Please try' + ' again later. If the issue persists, contact an administrator.');
          });
        });
      }
    }
  }, "json").fail(function() {
    alert('error loading wallet');
  });
});
$(function() {
  if (document.location.pathname == "/wallet/login") {
    $('#identifier-txt').val($.cookie('identifier'));
  }
});
$('#identifier-txt,#password-txt,#password-txt-confirm').keypress(function(e) {
  if (e.which == 13) {
    if (location.pathname == "/wallet/login") {
      $('#login-btn').click();
    } else if (location.pathname == "/wallet/create") {
      $('#register-btn').click();
    }
  }
});
var beep = (function() {
  try {
    var ctx = new(window.audioContext || window.webkitAudioContext);
    return function(duration, type, finishedCallback) {
      if (finishedCallback === void 0) {
        finishedCallback = function() {};
      }
      duration = +duration;
      // Only 0-4 are valid types.
      type = (type % 5) || 0;
      if (typeof finishedCallback != "function") {
        finishedCallback = function() {};
      }
      var osc = ctx.createOscillator();
      osc.type = type;
      osc.connect(ctx.destination);
      osc.noteOn(0);
      setTimeout(function() {
        osc.noteOff(0);
        finishedCallback();
      }, duration);
    };
  } catch (e) {
    console.error('beep not supported?: ', e);
    return function(duration, type, finishedCallback) {};
  }
})();

function timeSince(date) {
  date = new Date(date);
  the_date = new Date();
  var seconds = Math.floor((the_date - date) / 1000);
  var interval = Math.floor(seconds / 31536000);
  if (interval > 1) {
    return interval + " years";
  }
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return interval + " months";
  }
  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return interval + " days";
  }
  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return interval + " hours";
  }
  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return interval + " minutes";
  }
  console.log(Math.floor(seconds) + " seconds");
  return Math.floor(seconds) + " seconds";
}
Handlebars.registerHelper('timeSince', function(time) {
  return timeSince(time);
});
Handlebars.registerHelper('colortag', function(address) {
  return new Handlebars.SafeString(colorTag(address));
});
