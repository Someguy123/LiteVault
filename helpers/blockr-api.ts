declare var require, module;

var http = require('http');
var querystring = require('querystring');

module Blockr {


    var blockr_coin = 'ltc';

    var http_config = {
        host: blockr_coin + '.blockr.io',
        path: '',
        method: 'GET'
    };

    export function http_request(url, callback, post = false, post_data = "") {
        var _cb = function(response) {
            var str = '';
            //another chunk of data has been received, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });
            //the whole response has been received, pass to callback
            response.on('end', function () {
                callback(str)
            });
        };
        var options = http_config;
        options.path = url;
        options.method = (post === true) ? 'POST' : 'GET';

        var req = http.request(options, _cb);
        if(post === true) {
            console.log("writing post request data: ", post_data);
            req.write(post_data);
        }
        req.end();
    }

    export class Address {
        protected prefix = '/api/v1/address';

        unspent(addresses, callback) {
            var addr_str;
            if(Array.isArray(addresses)) {
                addr_str = addresses.join();
            } else {
                // is already string
                addr_str = addresses;
            }
            var url = this.prefix + '/unspent/' + addr_str;
            console.log(http_config.host);
            console.log(url);
            return http_request(url, callback);
        }

        info(addresses, callback) {
            var addr_str;
            if(Array.isArray(addresses)) {
                addr_str = addresses.join();
            } else {
                // is already string
                addr_str = addresses;
            }
            var url = this.prefix + '/info/' + addr_str + "?confirmations=0";
            console.log(http_config.host);
            console.log(url);
            return http_request(url, callback);
        }
        txs(addresses, callback) {
            var addr_str;
            if(Array.isArray(addresses)) {
                addr_str = addresses.join();
            } else {
                // is already string
                addr_str = addresses;
            }
            var url = this.prefix + '/txs/' + addr_str + "?confirmations=0";
            console.log(http_config.host);
            console.log(url);
            return http_request(url, callback);
        }

        balances(addresses, callback, confirmations = 0) {
            var addr_str;
            if(Array.isArray(addresses)) {
                addr_str = addresses.join();
            } else {
                // is already string
                addr_str = addresses;
            }
            var url = this.prefix + '/balance/' + addr_str + '?confirmations='+confirmations;

            console.log(http_config.host);
            console.log(url);
            return http_request(url, callback);
        }
    }
    export class TX {
        protected prefix = '/api/v1/tx';

        push(tx : string, callback) {
            var url = this.prefix + '/push';
            var post_data = querystring.stringify({"hex": tx});
            console.log(url);
            console.log(post_data);
            http_request(url, callback, true, post_data);
        }
    }
}

module.exports = Blockr;