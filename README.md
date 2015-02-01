LiteVault
--------
Official Site: https://www.litevault.net

LiteVault was designed to give Litecoin a site like Blockchain.info, meaning a trustless wallet with client-side transaction signing, private key storage etc.

The initial version was developed in whole by Someguy123, as well as certain further updates.

## Donations

Please be aware that LiteVault does not sell anything, we don't run ads, we run PURELY from donations. Please donate if you find the service, or the source code useful.

BTC: 17PPTHmS8N34KYKdDc4Gn1psabteGS8EE3

LTC: LNWEjx3DKSAWKX5fkWfCwa2tWSQeo7ZmnR

## Licence

IMPORTANT: Litevault is **not under an open licence**. The source code is available to allow public contribution, security analysis, and for educational purposes, but **DOES NOT allow you to run your own version of Litevault** without permission from Someguy123.

You are allowed to:

  - run the service locally for
    - experimenting
    - security analysis
    - creating modifications (which are required to be
      made public under this same licence)
  - to use the source code for learning or teaching

You **MAY NOT**:

  - Run any form of service for public use, or internal use within an organisation without prior written permission from Someguy123
  - Re-licence any part of the source code
  - Use parts of LiteVault's source code in another project

This licence may change at any time by Someguy123's discretion.

Full licence details in the file `LICENCE`

## About

### Working Features

 - Encrypted Wallet Storage and loading
 - Private Key importing
 - Address Generation
 - Wallet Exporting
 - Balance tracking
 - 2 Factor Authentication (TOTP)
 - Sending and Receiving coins

### How does it work?

When the client visits our website, they download a Javascript file labelled `wallet.js`, rather than forms being submitted directly to our server, they're processed by Javascript.

Example:

 - User enters their identifier and password
 - User hits enter, or pressed "login"
 - wallet.js handles this event by:
   - Requesting the wallet data by sending a GET request to `/wallet/load/:identifier`
   - Attempting to AES decrypt the wallet data using the password entered by the user (never sent to the server)
   - Loading in the addresses from the decoded wallet data after it's verified, and saving the **sharedKey**
   - To store the wallet, there is a "sharedKey" contained inside the wallet, this is a randomly generated password that is shared between the user and the server which is used to authorise writing to their wallet file on the server.
   - The shared key is contained in the encrypted wallet data so it cannot be accessed without the correct password.
   - Before saving the wallet data to the server, we encrypt it using AES in the browser using the users password, this means that we're unable to see your private keys, labels, or addresses

## What technologies are used in this project?

We use standard CSS for our stylesheets, feel free to submit a pull request if you want us to convert to LESS or SASS.

The server is in NodeJS (using the ExpressJS framework), this allows us to use [BitcoinJS](http://bitcoinjs.org) on the server side if we need to do anything with transactions or blocks, e.g. for the unspent transaction API. On top of this, NodeJS is well known enough that others can easily contribute.

The frontend Javascript is written in Microsoft's [Typescript](http://www.typescriptlang.org/), Typescript cleans up Javascript by making some features in ECMAScript 6 available in older Javascript, it provides a lot of nice features such as real classes, interfaces, generics, types, enums among others. Typescript is now shipped natively with [Visual Studio 2013](http://www.visualstudio.com/en-us/products/visual-studio-community-vs) Update 2 (Windows only), and is supported in a lot of IDE's such as [Jetbrains WebStorm](https://www.jetbrains.com/webstorm/) (Win/Mac/Linux)(Recommended IDE for editing LiteVault).

Our templates are written in [Handlebars](http://handlebarsjs.com/), including both client partials, and backend templates.

## Notes

How to install:

    # required to compile certain files
    npm install -g handlebars typescript
    git clone https://github.com/someguy123/LiteVault.git
    # install dependancies in the repo dir
    cd LiteVault
    npm install
    # compile required files
    bash build.sh
    # load MySQL Schema
    mysql -u root -p YourDbName < schema.sql
    # Configure your database details
    cp config.example.js config.js
    vim config.js
    # run server
    node ./bin/www



Set up your IDE (WebStorm in this example) to automatically compile Typescript files in /lib using the command (cd /lib):

    tsc --sourcemap $FilePath$ --out ../public/assets/js/$FileNameWithoutExtension$.js

Compile all handlebars partials for client rendering (cd /public):

    handlebars partials/ -f assets/js/hbpartials.js
