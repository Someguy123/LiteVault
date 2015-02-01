#!/bin/bash

# compile helpers
echo "Compiling helpers"
tsc helpers/*.ts --outDir helpers/

# compile wallet.ts
echo "Compiling wallet.ts"
tsc lib/wallet.ts --out public/assets/js/wallet.js --sourcemap

# compile handlebars partials
echo "Compiling handlebars partials"
handlebars views/partials/ -f public/assets/js/hbpartials.js