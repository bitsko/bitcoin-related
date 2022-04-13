/**
 * termcoin - a bitcoin wallet for your terminal
 * Copyright (c) 2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/termcoin
 *
 * Resources:
 *   https://en.bitcoin.it/wiki/Original_Bitcoin_client/API_Calls_list
 *   https://github.com/bitcoin/bitcoin/blob/master/src/rpcserver.cpp
 *   https://github.com/bitcoin/bitcoin/blob/master/src/rpcrawtransaction.cpp
 *   https://github.com/bitcoin/bitcoin/blob/master/src/rpcwallet.cpp
 */

/**
 * Exports
 */

var bitcoind = exports;

/**
 * Modules
 */

var fs = require('fs');

/**
 * Load
 */

var termcoin = require('../')
  , utils = termcoin.utils
  , config = termcoin.config
  , mock = termcoin.mock
  , opt = config.opt
  , platform = config.platform
  , config = config.config;

/*
 * Constants
 */

bitcoind.name = 'bitcoind';
bitcoind.restart = true;

/**
 * API Calls
 */

bitcoind.getStats = function(callback) {
  utils.parallel({
    balance: bitcoind.getTotalBalance,
    accounts: bitcoind.getAccounts,
    transactions: bitcoind.getTransactions,
    addresses: bitcoind.getAddresses,
    info: bitcoind.getInfo,
    encrypted: bitcoind.isEncrypted
  }, callback);
};

// XXX Ridiculous workaround, but, short of including berkeley db bindings,
// this is the only way to extract "send" addresses from the wallet.dat.
bitcoind.getAddresses = function(accounts, callback) {
  if (opt.remote) return callback(null, []);

  if (!callback) {
    callback = accounts;
    accounts = null;
  }

  var wallet
    , results = []
    , ma = []
    , m;

  try {
    wallet = fs.readFileSync(platform.wallet, 'ascii');
  } catch (e) {
    return callback(null, results);
  }

  // Bitcoin addresses are 27-35 bytes in length.
  // https://bitcointalk.org/index.php?topic=1026.0
  do {
    if (m = /^[a-zA-Z1-9]{27}/g.exec(wallet)) ma.push(m[0]);
    if (m = /^[a-zA-Z1-9]{28}/g.exec(wallet)) ma.push(m[0]);
    if (m = /^[a-zA-Z1-9]{29}/g.exec(wallet)) ma.push(m[0]);
    if (m = /^[a-zA-Z1-9]{30}/g.exec(wallet)) ma.push(m[0]);
    if (m = /^[a-zA-Z1-9]{31}/g.exec(wallet)) ma.push(m[0]);
    if (m = /^[a-zA-Z1-9]{32}/g.exec(wallet)) ma.push(m[0]);
    if (m = /^[a-zA-Z1-9]{33}/g.exec(wallet)) ma.push(m[0]);
    if (m = /^[a-zA-Z1-9]{34}/g.exec(wallet)) ma.push(m[0]);
    if (m = /^[a-zA-Z1-9]{35}/g.exec(wallet)) ma.push(m[0]);
  } while (wallet = wallet.substring(1));

  if (!ma.length) {
    return callback(null, results);
  }

  return utils.forEach(ma, function(address, next) {
    return bitcoind.client.call('getaccount', [address], function(err, name) {
      if (err) return next();
      results.push({
        name: name,
        address: address
      });
      return next();
    });
  }, function() {
    if (accounts) {
      // Exclude the user's addresses.
      var add = Object.keys(accounts).map(function(key) {
        return accounts[key].address;
      });
      results = results.filter(function(item) {
        return add.indexOf(item.address) === -1;
      });
    }
    return callback(null, results);
  });
};

bitcoind.getAccounts = function(callback) {
  var results = {};
  return bitcoind.client.call('listaccounts', function(err, accounts) {
    if (err) return callback(err);
    return utils.forEach(Object.keys(accounts), function(name, next) {
      return bitcoind.client.call('getaddressesbyaccount', [name], function(err, addresses) {
        if (err) return next();
        addresses.forEach(function(address) {
          results[address] = {
            name: name,
            address: address,
            balance: accounts[name]
          };
        });
        return next();
      });
    }, function() {
      return callback(null, results);
    });
  });
};

// This is kind of awkward, but in order to calculate
// the number of hours behind we are, we need to:
//   1. Get the hash of the genesis block.
//   2. Retrieve the genesis block based on the hash.
//   3. Get the current block count (how many we have so far).
//   4. Get the hash of the latest block using the block count.
//   5. Get our latest block using the hash.
//   6. Use the timestamps on the genesis block as well as our latest block,
//   and compare them with the current time to determine the amount of time
//   beind we are. This isn't perfectly accurate because `Date.now()` doesn't
//   necessary represent the time the last block was found.
bitcoind.getProgress = function(callback) {
  return bitcoind.client.call('getconnectioncount', function(err, connections) {
    if (err) return callback(err);
    return bitcoind.client.call('getblockhash', [0], function(err, hash) {
      if (err) return callback(err);
      return bitcoind.client.call('getblock', [hash], function(err, genesis) {
        if (err) return callback(err);
        return bitcoind.client.call('getblockcount', function(err, count) {
          if (err) return callback(err);
          return bitcoind.client.call('getblockhash', [count], function(err, hash) {
            if (err) return callback(err);
            return bitcoind.client.call('getblock', [hash], function(err, current) {
              if (err) return callback(err);

              var beginning = genesis.time
                , end = Date.now() / 1000 | 0
                , left = end - current.time
                , perc = ((current.time - beginning) / (end - beginning)) * 100 | 0;

              return callback(null, {
                blocks: count,
                connections: connections,
                genesisBlock: genesis,
                currentBlock: current,
                hoursBehind: left / 60 / 60 | 0,
                daysBehind: left / 60 / 60 / 24 | 0,
                percent: perc
              });
            });
          });
        });
      });
    });
  });
};

bitcoind.getInfo = function(callback) {
  return bitcoind.client.call('getinfo', callback);
};

bitcoind.getTransactions = function(callback) {
  if (opt.mock) {
    return callback(null, utils.tsort(mock.transactions, true));
  }
  return bitcoind.client.call('listtransactions', ['*', 1000], function(err, transactions) {
    if (err) return callback(err);
    return callback(null, utils.tsort(transactions, true));
  });
};

bitcoind.getTotalBalance = function(callback) {
  return bitcoind.client.call('getbalance', ['*', 6], function(err, balance) {
    if (err) return callback(err);
    return bitcoind.client.call('getbalance', ['*', 0], function(err, unconfirmed) {
      if (err) return callback(err);
      unconfirmed -= balance;
      return callback(null, {
        balance: balance,
        unconfirmed: unconfirmed
      });
    });
  });
};

bitcoind.signMessage = function(address, message, callback) {
  return bitcoind.client.call('signmessage', [address, message], callback);
};

bitcoind.verifyMessage = function(address, sig, message, callback) {
  return bitcoind.client.call('verifymessage', [address, sig, message], callback);
};

bitcoind.createAddress = function(name, callback) {
  return bitcoind.client.call('getnewaddress', [name], callback);
};

bitcoind.listReceivedByAddress = function(address, callback) {
  if (opt.mock) return callback(null, received);
  return bitcoind.client.call('listreceivedbyaddress', [address, sig, message], callback);
};

bitcoind.backupWallet = function(path, callback) {
  return bitcoind.client.call('backupwallet', [path], callback);
};

bitcoind.encryptWallet = function(passphrase, callback) {
  return bitcoind.client.call('encryptwallet', [passphrase], callback);
};

bitcoind.decryptWallet = function(passphrase, timeout, callback) {
  return bitcoind.client.call('walletpassphrase', [passphrase, timeout], function(err) {
    if (err) {
      if (~err.message.indexOf('Wallet is already unlocked')) {
        return callback();
      }
      return callback(err);
    }
    return callback();
  });
};

bitcoind.changePassphrase = function(opassphrase, npassphrase, callback) {
  return bitcoind.client.call('walletpassphrasechange', [opassphrase, npassphrase], callback);
};

bitcoind.forgetKey = function(callback) {
  return bitcoind.client.call('walletlock', callback);
};

bitcoind.isEncrypted = function(callback) {
  return bitcoind.client.call('walletpassphrase', [], function(err) {
    if (err) {
      if (err.code === -15 && ~err.message.indexOf('unencrypted wallet')) {
        return callback(null, false);
      }
      if (~err.message.indexOf('walletpassphrase <passphrase> <timeout>')) {
        return callback(null, true);
      }
      return callback(err);
    }
    return callback(null, true);
  });
};

bitcoind.send = function(address, amount, callback) {
  return bitcoind.client.call('sendtoaddress', [address, amount], callback);
};

bitcoind.sendFrom = function(from, address, amount, callback) {
  return bitcoind.client.call('sendfrom', [from, address, amount], callback);
};

bitcoind.move = function(from, to, amount, callback) {
  return bitcoind.client.call('move', [from, to, amount], callback);
};

// bitcoin.deleteAccount = function(address, callback) {
//   ;
// };

// bitcoin.changeLabel = function(address, label, callback) {
//   ;
// };

bitcoind.setAccount = function(address, label, callback) {
  var args = [address, label];
  if (!callback) {
    callback = label;
    label = null;
    args = [address];
  }
  return bitcoind.client.call('setaccount', args, callback);
};

bitcoind.getBlock = function(id, callback) {
  return bitcoind.client.call('getblock', [id, true], callback);
};

bitcoind.getTransaction = function(id, callback) {
  return bitcoind.client.call('gettransaction', [id, true], callback);
};

bitcoind.setTxFee = function(value, callback) {
  return bitcoind.client.call('settxfee', [+value], callback);
};

bitcoind.importPrivKey = function(key, label, rescan, callback) {
  var args = [key, label, !!rescan];
  if (!rescan) {
    callback = label;
    args = [key];
  }
  if (!callback) {
    callback = rescan;
    args = [key, label];
  }
  return bitcoind.client.call('importprivkey', args, callback);
};

bitcoind.dumpPrivKey = function(address, callback) {
  return bitcoind.client.call('dumpprivkey', [address], callback);
};

bitcoind.importWallet = function(file, callback) {
  return bitcoind.client.call('importwallet', [file], callback);
};

bitcoind.dumpWallet = function(file, callback) {
  return bitcoind.client.call('dumpwallet', [file], callback);
};

bitcoind.keyPoolRefill = function(callback) {
  return bitcoind.client.call('keypoolrefill', callback);
};

bitcoind.getGenerate = function(callback) {
  return bitcoind.client.call('getgenerate', callback);
};

bitcoind.setGenerate = function(flag, threads, callback) {
  var args = [flag, +threads];
  if (!callback) {
    callback = threads;
    threads = null;
    args = [flag];
  }
  return bitcoind.client.call('setgenerate', args, callback);
};

bitcoind.getMiningInfo = function(callback) {
  return bitcoind.client.call('getmininginfo', callback);
};

bitcoind.stopServer = function(callback) {
  return bitcoind.client.call('stop', callback);
};

/**
 * Start Server
 */

bitcoind.startServer = function(callback) {
  if (opt.remote) return callback(null, false);

  try {
    fs.statSync(platform.pid);
    if (!bitcoind.startServer._ran) {
      bitcoind.startServer._ran = true;
    }
    return callback(null, false);
  } catch (e) {
    ;
  }

  // Temporarily disable smart port handling:
  // config.rpcport = 9999;
  // bitcoind.client.options.port = 9999;

  if (!bitcoind.startServer._ran) {
    bitcoind.startServer._ran = true;
    bitcoind.startServer.started = true;
    console.log('Starting new server on port ' + config.rpcport + '...');
  }

  var args = [
    '-server',
    '-daemon',
    '-rpcallowip=127.0.0.1'
  ];

  if (config.rpcuser !== config.original.rpcuser) {
    args.push('-rpcuser=' + config.rpcuser);
  }

  if (config.rpcpassword !== config.original.rpcpassword) {
    args.push('-rpcpassword=' + config.rpcpassword);
  }

  if (+config.rpcport !== +config.original.rpcport) {
    // This `if` statement is most likely unnecessary,
    // but we'll keep it here for neatness. Removing
    // might have the benefit of compensating if one
    // of the platforms changes the default port in
    // the future.
    if (config.original.rpcport
        || +config.rpcport !== +platform.port
        || platform.unknown) {
      args.push('-rpcport=' + config.rpcport);
    }
  }

  if (opt.datadir) {
    args.push('-datadir=' + opt.datadir);
    args.push('-conf=' + platform.config);
  }

  return utils.daemonize(platform.daemon, args, function(err) {
    if (err) return callback(err);
    return bitcoind.client.call('listaccounts', function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, true);
    });
  });
};

bitcoind.startClient = function() {
  return new Client({
    host: config.rpcconnect,
    port: config.rpcport,
    user: config.rpcuser,
    pass: config.rpcpassword,
    ssl: config.rpcssl
  });
};

/**
 * Client
 */

function Client(options) {
  this.options = options;
  this.maxAttempts = options.maxAttempts || opt.maxAttempts || 30;
  this._id = 0;
}

Client.prototype.call = function(method, params, callback) {
  if (!callback) {
    callback = params;
    params = [];
  }
  return this._call({ method: method, params: params }, callback);
};

Client.prototype._call = function(call, options, callback) {
  var self = this;

  if (!callback) {
    callback = options;
    options = {};
  }

  if (Array.isArray(call)) {
    options.body = call.map(function(item) {
      return {
        id: self._id++,
        method: item.method,
        params: item.params
      };
    });
  } else {
    options.body = {
      id: self._id++,
      method: call.method,
      params: call.params
    };
  }

  return this.request(options, callback);
};

Client.prototype.request = function(options, callback) {
  var self = this
    , path = options.path || '/'
    , body = options.body || {}
    , method = options.method || 'POST'
    , cb = callback
    , attempts = 0;

  if (typeof callback !== 'function') {
    callback = function() {};
  }

  options = {
    method: method,
    uri: (this.options.ssl ? 'https' : 'http')
      + '://'
      + encodeURIComponent(this.options.user)
      + ':'
      + encodeURIComponent(this.options.pass)
      + '@'
      + this.options.host
      + ':'
      + this.options.port
      + path,
    json: body
  };

  (function retry() {
    if (self.lock) return callback(null, {});
    return utils.request(options, function(err, res, body) {
      if (self.lock) return callback(null, {});

      if (err) {
        if (err.code === 'ECONNREFUSED' || err.message === 'socket hang up') {
          if (++attempts === opt.maxAttempts) {
            return callback(err);
          }
          return setTimeout(function() {
            return retry();
          }, 1000);
        }
        return callback(err);
      }

      if (res.statusCode === 403 || res.statusCode === 401) {
        return callback(new Error('Forbidden.'));
      }

      if (res.statusCode === 404) {
        return callback(new Error('Not found.'));
      }

      try {
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
      } catch (e) {
        e.message += '\nStatus code: ' + res.statusCode + '.';
        e.message += '\nJSON: ' + body;
        return callback(e);
      }

      if (!body) {
        return callback(new Error('No body.'));
      }

      if (body.error) {
        err = new Error(body.error.message);
        err.code = body.error.code;
        return callback(err);
      }

      return callback(null, body.result);
    });
  })();
};

/**
 * Start Client
 */

bitcoind.client = bitcoind.startClient();
