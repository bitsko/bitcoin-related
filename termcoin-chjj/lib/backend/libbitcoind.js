/**
 * termcoin - a bitcoin wallet for your terminal
 * Copyright (c) 2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/termcoin
 */

/**
 * Exports
 */

var bitcoind = exports;

/**
 * Modules
 */

var fs = require('fs');
var util = require('util');
var coined = require('coined');
var bn = coined.bn;

var debug = {};

if (process.env.NODE_ENV === 'debug') {
  debug.logger = fs.createWriteStream(process.env.HOME + '/termcoin.log');
}

debug.log = function() {
  if (process.env.NODE_ENV !== 'debug') return;
  var args = Array.prototype.slice.call(arguments);
  if (typeof args[0] !== 'string') {
    if (typeof args[0] === 'function') args[0] = args[0] + '';
    var out = util.inspect(args[0], null, 20, true);
    return debug.logger.write(out + '\n');
  }
  var out = util.format.apply(util, args);
  return debug.logger.write(out + '\n');
};

debug.error = function() {
  var args = Array.prototype.slice.call(arguments);
  if (args[0] && args[0].message) {
    args[0] = args[0].message;
  }
  if (typeof args[0] !== 'string') {
    if (typeof args[0] === 'function') args[0] = args[0] + '';
    var out = util.inspect(args[0], null, 20, true);
    if (process.env.NODE_ENV !== 'debug') return new Error(out);
    debug.logger.write('ERROR: ' + out + '\n');
    return new Error(out);
  }
  var out = util.format.apply(util, args);
  if (process.env.NODE_ENV !== 'debug') return new Error(out);
  debug.logger.write('ERROR: ' + out + '\n');
  return new Error(out);
};

if (process.env.CLEAN_ALL || process.env.CLEAN_WALLET) {
  var subdir = '';

  if (process.env.NODE_ENV === 'debug') {
    subdir = '/testnet3';
  }

  if (process.env.CLEAN_ALL) {
    var rimraf = require('rimraf');
    if (fs.existsSync(process.env.HOME + '/.termcoin-bitcoind' + subdir)) {
      rimraf.sync(process.env.HOME + '/.termcoin-bitcoind' + subdir);
    }
  } else if (process.env.CLEAN_WALLET) {
    if (fs.existsSync(process.env.HOME + '/.termcoin-bitcoind' + subdir + '/wallet.dat')) {
      fs.unlinkSync(process.env.HOME + '/.termcoin-bitcoind' + subdir + '/wallet.dat');
    }
  }
}

/**
 * Load
 */

var termcoin = require('../')
  , utils = termcoin.utils
  , config = termcoin.config
  , mock = termcoin.mock
  , opt = config.opt
  , platform = config.platform
  , config = config.config
  , bitcoindjs;

// Compatibility with old node versions:
var setImmediate = global.setImmediate || process.nextTick.bind(process);

/*
 * Constants
 */

bitcoind.name = 'libbitcoind';
bitcoind.restart = true;

/**
 * API Calls
 */

bitcoind.getStats = function(callback) {
  return utils.parallel({
    balance: bitcoind.getTotalBalance,
    accounts: bitcoind.getAccounts,
    transactions: bitcoind.getTransactions,
    addresses: bitcoind.getAddresses,
    info: bitcoind.getInfo,
    encrypted: bitcoind.isEncrypted
  }, function(err, result) {
    debug.log('getStats/[nothing]:');
    if (err) {
      debug.error(err);
      return callback(err);
    }
    debug.log(Object.keys(result));
    return callback(null, result);
  });
};

bitcoind.getAddresses = function(accounts, callback) {
  if (!callback) {
    callback = accounts;
    accounts = null;
  }
  setImmediate(function() {
    debug.log('getAddresses/wallet.getRecipients:');
    try {
      var recipients = bitcoindjs.wallet.getRecipients({});
      debug.log(recipients);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
    var addr = [];
    recipients.forEach(function(recipient) {
      addr.push({
        name: recipient.label,
        address: recipient.address
      });
    });
    debug.log(addr);
    return callback(null, addr);
  });
};

bitcoind.getAccounts = function(options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }
  setImmediate(function() {
    debug.log('getAccounts/wallet.getAccounts:');
    try {
      var acc = bitcoindjs.wallet.getAccounts(options);
      debug.log(acc);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
    var keys = Object.keys(acc);
    var results = {};
    keys.forEach(function(key) {
      var account = acc[key];
      account.addresses.forEach(function(address) {
        results[address.address] = {
          name: key,
          address: address.address,
          balance: account.balance / 100000000
        };
      });
    });
    debug.log(results);
    return callback(null, results);
  });
};

bitcoind.getProgress = function(callback) {
  setImmediate(function() {
    debug.log('getProgress/getProgress:');
    bitcoindjs.getProgress(function(err, progress) {
      if (err) {
        debug.error(err);
        return callback(err);
      }
      debug.log(progress);
      return callback(null, progress);
    });
  });
};

bitcoind.getInfo = function(callback) {
  setImmediate(function() {
    debug.log('getInfo/getInfo:');
    try {
      var info = bitcoindjs.getInfo();
      debug.log(info);
      return callback(null, info);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.getTransactions = function(options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }
  setImmediate(function() {
    debug.log('getTransactions/wallet.getTransactions:');

    // try {
    //   return bitcoindjs.wallet.getTransactions(options, function(err, txs) {
    //     if (err) return callback(err);
    //     txs = txs.map(function(tx) {
    //       tx = transforms.tx.libbitcoindToBitcoin(tx);
    //       // tx = tx._walletTransaction;
    //       return tx;
    //     });
    //     txs = txs.map(function(tx) {
    //       tx.amount = tx.amount / 100000000;
    //       return tx;
    //     });
    //     debug.log(txs);
    //     return callback(null, txs);
    //   });
    // } catch (e) {
    //   debug.error(e);
    //   return callback(e);
    // }

    try {
      // XXX Wallet Transactions
      var txs = bitcoindjs.wallet.getTransactions(options);
      txs = txs.map(function(tx) {
        // NOTE: bitcoind makes sent amounts negative.
        if (tx.amount < 0) {
          tx.amount = -tx.amount;
        }
        tx.amount = tx.amount / 100000000;
        return tx;
      });
      debug.log(txs);
      return callback(null, txs);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.getTotalBalance = function(options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }
  setImmediate(function() {
    debug.log('getTotalBalance/wallet.getBalance:');
    try {
      var balance = bitcoindjs.wallet.getBalance(options);
      debug.log(balance);
      var unconfirmed = bitcoindjs.wallet.getBalance(
        utils.merge({}, options, { confirmations: 0 })
      );
      debug.log(unconfirmed);
      return callback(null, {
        balance: balance / 100000000,
        unconfirmed: (unconfirmed - balance) / 100000000
      });
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.signMessage = function(address, message, callback) {
  var options = {
    address: address,
    message: message
  };
  setImmediate(function() {
    debug.log('signMessage/wallet.signMessage:');
    try {
      var signed = bitcoindjs.wallet.signMessage(options);
      debug.log(signed);
      return callback(null, signed);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.verifyMessage = function(address, sig, message, callback) {
  var options = {
    address: address,
    signature: sig,
    message: message
  };
  setImmediate(function() {
    debug.log('verifyMessage/wallet.verifyMessage:');
    try {
      var verified = bitcoindjs.wallet.verifyMessage(options);
      debug.log(verified);
      return callback(null, verified);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.createAddress = function(name, callback) {
  setImmediate(function() {
    debug.log('createAddress/wallet.createAddress:');
    try {
      var addr = bitcoindjs.wallet.createAddress({
        name: name
      });
      debug.log(addr);
      return callback(null, addr);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.listReceivedByAddress = function(address, callback) {
  setImmediate(function() {
    debug.log('listReceivedByaddress/wallet.getReceivedByAddress:');
    try {
      var recv = bitcoindjs.wallet.getReceivedByAddress({
        address: address
      });
      debug.log(recv);
      return callback(null, recv);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.backupWallet = function(path, callback) {
  setImmediate(function() {
    debug.log('backupWallet/wallet.backup:');
    try {
      var backup = bitcoindjs.wallet.backup({
        path: path
      });
      debug.log(backup);
      return callback(null, backup);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.encryptWallet = function(passphrase, callback) {
  setImmediate(function() {
    debug.log('encryptWallet/wallet.encrypt:');
    try {
      var encrypted = bitcoindjs.wallet.encrypt({
        passphrase: passphrase
      });
      debug.log(encrypted);
      return callback(null, encrypted);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.decryptWallet = function(passphrase, timeout, callback) {
  setImmediate(function() {
    debug.log('decryptWallet/wallet.decrypt:');
    try {
      var decrypted = bitcoindjs.wallet.decrypt({
        passphrase: passphrase
        // NOTE: bitcoind.js has no timeout
        // timeout: timeout
      });
      debug.log(decrypted);
      return callback(null, decrypted);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.unencryptWallet = function(passphrase, callback) {
  return bitcoind.decryptWallet(passphrase, 0, callback);
};

bitcoind.changePassphrase = function(opassphrase, npassphrase, callback) {
  setImmediate(function() {
    debug.log('changePassphrase/wallet.passphraseChange:');
    try {
      var changed = bitcoindjs.wallet.passphraseChange({
        oldPass: opassphrase,
        newPass: npassphrase
      });
      debug.log(changed);
      return callback(null, changed);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.forgetKey = function(callback) {
  setImmediate(function() {
    debug.log('forgetKey/wallet.lock:');
    try {
      var locked = bitcoindjs.wallet.lock();
      debug.log(locked);
      return callback(null, locked);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.isEncrypted = function(callback) {
  setImmediate(function() {
    debug.log('isEncryped/wallet.isEncrypted:');
    try {
      var encrypted = bitcoindjs.wallet.isEncrypted();
      debug.log(encrypted);
      return callback(null, encrypted);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.send = function(address, amount, callback) {
  setImmediate(function() {
    debug.log('send/wallet.sendTo:');
    amount = amount * 100000000;
    try {
      var sent = bitcoindjs.wallet.sendTo({
        address: address,
        amount: amount
      }, function(err, sent) {
        if (err) {
          debug.log(err);
          return callback(err);
        }
        debug.log(sent);
        return callback(null, sent);
      });
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.sendFrom = function(from, address, amount, callback) {
  setImmediate(function() {
    debug.log('sendFrom/wallet.sendFrom:');
    amount = amount * 100000000;
    try {
      bitcoindjs.wallet.sendFrom({
        from: from,
        address: address,
        amount: amount
        // minDepth: minDepth
        // comment: comment
        // to: to
      }, function(err, sent) {
        if (err) {
          debug.log(err);
          return callback(err);
        }
        debug.log(sent);
        return callback(null, sent);
      });
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.move = function(from, to, amount, callback) {
  setImmediate(function() {
    debug.log('move/wallet.move:');
    amount = amount * 100000000;
    try {
      var moved = bitcoindjs.wallet.move({
        from: from,
        to: to,
        amount: amount
      });
      debug.log(moved);
      return callback(null, moved);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.changeLabel = function(address, label, callback) {
  setImmediate(function() {
    debug.log('changeLabel/wallet.changeLabel:');
    try {
      var changed = bitcoindjs.wallet.changeLabel({
        address: address,
        label: label
      });
      debug.log(changed);
      return callback(null, changed);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.deleteAccount = function(address, callback) {
  setImmediate(function() {
    debug.log('deleteAccount/wallet.deleteAccount');
    try {
      var deleted = bitcoindjs.wallet.deleteAccount({
        address: address
      });
      debug.log(deleted);
      return callback(null, deleted);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.setAccount = function(address, label, callback) {
  setImmediate(function() {
    debug.log('setAccount/wallet.setAccount:');
    try {
      var set = bitcoindjs.wallet.setAccount({
        address: address,
        label: label
      });
      debug.log(set);
      return callback(null, set);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.getBlock = function(id, callback) {
  id = id.hash || id;
  return bitcoindjs.getBlock(id, function(err, block) {
    debug.log('getBlock/getBlock:');
    if (err) {
      debug.error(err);
      return callback(err);
    }
    // block = transforms.block.libbitcoindToBitcoin(block);
    debug.log(Object.keys(block));
    return callback(null, block);
  });
};

bitcoind.getTransaction = function(id, blockhash, callback) {
  if (typeof id === 'object' && id) {
    var options = id;
    callback = blockhash;
    id = options.txid || options.tx || options.id || options.hash;
    blockhash = options.blockhash || options.block;
  }
  if (!callback) {
    callback = blockhash;
    blockhash = '';
  }
  if (blockhash && typeof blockhash !== 'string') {
    blockhash = blockhash.hash || blockhash.blockhash || '';
  } else {
    blockhash = '';
  }
  return bitcoindjs.getTransaction(id, blockhash, function(err, tx) {
    debug.log('getTransaction/getTx:');
    if (err) {
      debug.error(err);
      return callback(err);
    }
    debug.log(Object.keys(tx));
    // tx = transforms.tx.libbitcoindToBitcoin(tx);
    return callback(null, tx);
  });
};

bitcoind.setTxFee = function(options, callback) {
  setImmediate(function() {
    debug.log('setTxFee/wallet.setTxFee:');
    try {
      var fee = bitcoindjs.wallet.setTxFee(options);
      debug.log(fee);
      return callback(null, fee);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.importPrivKey = function(key, label, rescan, callback) {
  var options = {
    key: key,
    label: label,
    rescan: rescan
  };
  return bitcoindjs.wallet.importKey(options, function(err, imported) {
    debug.log('importPrivKey/wallet.importKey:');
    if (err) {
      debug.error(err);
      return callback(err);
    }
    debug.log(imported);
    return callback(null, imported);
  });
};

bitcoind.dumpPrivKey = function(address, callback) {
  setImmediate(function() {
    debug.log('dumpPrivKey/wallet.dumpKey:');

    if (bitcoindjs.wallet.isLocked()) {
      return callback(debug.error('Wallet is encrypted.'));
    }

    try {
      var dump = bitcoindjs.wallet.dumpKey({
        address: address
      }).privkey;
      debug.log(dump);
      return callback(null, dump);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.importWallet = function(file, callback) {
  setImmediate(function() {
    debug.log('importWallet/wallet.import:');
    try {
      bitcoindjs.wallet.import({
        path: file
      }, function(err, result) {
        if (err) {
          debug.error(err);
          return callback(err);
        }
        debug.log(result);
        return callback(null, result);
      });
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.dumpWallet = function(file, callback) {
  setImmediate(function() {
    debug.log('dumpWallet/wallet.dump:');
    try {
      return bitcoindjs.wallet.dump({
        path: file
      }, function(err, result) {
        if (err) {
          debug.error(err);
          return callback(err);
        }
        debug.log(result);
        return callback(null, result);
      });
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.keyPoolRefill = function(options, callback) {
  if (!options) {
    callback = options;
    options = {};
  }
  setImmediate(function() {
    debug.log('keyPoolRefill/wallet.keyPoolRefill:');
    try {
      var refilled = bitcoindjs.wallet.keyPoolRefill(options);
      debug.log(refilled);
      return callback(null, refilled);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.getGenerate = function(options, callback) {
  if (!options) {
    callback = options;
    options = {};
  }
  setImmediate(function() {
    debug.log('getGenerate/getGenerate:');
    try {
      var generate = bitcoindjs.getGenerate(options);
      debug.log(generate);
      return callback(null, generate);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.setGenerate = function(options, callback) {
  if (!options) {
    callback = options;
    options = {};
  }
  setImmediate(function() {
    debug.log('setGenerate/setGenerate:');
    try {
      var generate = bitcoindjs.setGenerate(options);
      debug.log(generate);
      return callback(null, generate);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.getMiningInfo = function(options, callback) {
  if (!options) {
    callback = options;
    options = {};
  }
  setImmediate(function() {
    debug.log('getMininginfo/getMiningInfo:');
    try {
      var info = bitcoindjs.getMiningInfo(options);
      debug.log(info);
      return callback(null, info);
    } catch (e) {
      debug.error(e);
      return callback(e);
    }
  });
};

bitcoind.getBlockHeight = function(height, callback) {
  setImmediate(function() {
    return bitcoindjs.getBlockHeight(height, function(err, block) {
      if (err) return callback(err);
      return callback(null, block);
    });
  });
};

bitcoind.getRawBlock = function(hash, callback) {
  setImmediate(function() {
    return bitcoindjs.getBlock(hash, function(err, block) {
      if (err) return callback(err);
      return callback(null, block.hex);
    });
  });
};

bitcoind.getRawTransaction = function(txid, block, callback) {
  setImmediate(function() {
    return bitcoindjs.getTransaction(txid, block, function(err, tx) {
      if (err) return callback(err);
      return callback(null, tx.hex);
    });
  });
};

bitcoind.getLastBlock = function(callback) {
  return bitcoind.getProgress(function(err, progress) {
    if (err) return callback(err);
    return callback(null, progress.currentBlock);
  });
};

bitcoind.getAddrTransactions = function(addr, callback) {
  addr = addr.address || addr;
  return bitcoindjs.getAddrTransactions(addr, function(err, addr) {
    if (err) return callback(err);
    // addr = transforms.addr.libbitcoindToBitcoin(addr);
    return callback(null, addr);
  });
};

bitcoind.rescan = function(options, callback) {
  debug.log('rescan');
  return bitcoindjs.wallet.rescan(options, function(err, result) {
    if (err) {
      debug.error(err);
      return callback(err);
    }
    debug.log(result);
    return callback(null, result);
  });
};

bitcoind.stopServer = function(callback) {
  return bitcoindjs.stop(function(err, status) {
    debug.log('stopServer/stop:');
    if (err) {
      debug.error(err);
      return callback(err);
    }
    debug.log([status, true]);
    return callback(null, true);
  });
};

/**
 * Start Server
 */

bitcoind.startServer = function(callback) {
  debug.log('startServer/[new]:');

  bitcoindjs = require('bitcoind.js')({
    directory: termcoin.config.platform.datadir,
    testnet: termcoin.config.useTestnet
      || termcoin.config.testnet
      || process.env.NODE_ENV === 'debug'
      || false,
    rpc: termcoin.config.useRPC || false,
    silent: true
  });

  bitcoind.startServer.started = true;

  bitcoind.js = bitcoindjs;

  // Extras
  Object.getOwnPropertyNames(bitcoindjs.__proto__).forEach(function(name) {
    var method = bitcoindjs[name];
    if (!bitcoind[name]) {
      bitcoind[name] = function() {
        debug.log(name + '()');
        return method.apply(bitcoindjs, arguments);
      };
    }
  });

  // Make these functions suitable for testnet
  if (bitcoindjs.network.name === 'testnet') {
    var base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ' +
                 'abcdefghijkmnopqrstuvwxyz';

    coined.bcoin.wallet.addr2hash = function addr2hash(addr) {
      if (!Array.isArray(addr))
        addr = coined.bcoin.utils.fromBase58(addr);

      //if (addr.length !== 25)
      //  return [];
      //if (addr[0] !== 111) // 0
      //  return [];

      //var chk = coined.bcoin.utils.checksum(addr.slice(0, -4));
      //if (coined.bcoin.utils.readU32(chk, 0) !== coined.bcoin.utils.readU32(addr, 21))
      //  return [];

      return addr.slice(1, -4);
    };

    coined.bcoin.utils.fromBase58 = function fromBase58(str) {
      // Count leading "zeroes"
      for (var i = 0; i < str.length; i++)
        if (str[i] !== 'm' && str[i] !== 'n' && str[i] !== '2') // '1'
          break;
      var zeroes = i;

      // Read 4-char words and add them to bignum
      var q = 1;
      var w = 0;
      var res = new bn(0);
      for (var i = zeroes; i < str.length; i++) {
        var c = base58.indexOf(str[i]);
        if (!(c >= 0 && c < 58)) // maybe: c >= 111
          return [];

        q *= 58;
        w *= 58;
        w += c;
        if (i === str.length - 1 || q === 0xacad10) {
          res = res.mul(new bn(q)).add(new bn(w));
          q = 1;
          w = 0;
        }
      }

      // Add leading "zeroes"
      var z = [];
      for (var i = 0; i < zeroes; i++)
        z.push(0); // maybe: 111
      return z.concat(res.toArray());
    };
  }

  bitcoindjs.on('open', function() {
    return callback(null, bitcoind);
  });

  bitcoindjs.on('error', function(err) {
    throw err;
  });
};
