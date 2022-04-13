/**
 * termcoin - a bitcoin wallet for your terminal
 * Copyright (c) 2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/termcoin
 */

/**
 * Exports
 */

var ui = exports;

/**
 * Modules
 */

var fs = require('fs')
  , cp = require('child_process');

/**
 * Dependencies
 */

var blessed = require('blessed');

/**
 * Load
 */

var termcoin = require('./')
  , utils = termcoin.utils
  , config = termcoin.config
  , mock = termcoin.mock
  , bitcoin = termcoin.bitcoin
  , opt = config.opt
  , platform = config.platform
  , blockchain = require('./explore/blockchain');

var coined = require('coined')
  , bcoin = coined.bcoin
  , bn = coined.bn;

var setImmediate = typeof global.setImmediate !== 'function'
  ? process.nextTick.bind(proccess)
  : global.setImmediate;

var coin = termcoin.bitcoin.coin;

/**
 * Variables
 */

ui.decryptTime = 0;
ui.lock = false;
ui.sep = ' │ ';

/**
 * Start
 */

ui.start = function(stats, callback) {
  var screen = blessed.screen({
    autoPadding: true,
    fastCSR: true,
    log: process.env.HOME + '/.termcoin/debug.ui.log'
  });

  termcoin.screen = screen;

  screen._.target = null;

  screen._.wrapper = blessed.box({
    parent: screen,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  });

  screen._.bar = blessed.listbar({
    parent: screen._.wrapper,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    keys: true,
    mouse: true,
    autoCommandKeys: true,
    style: {
      item: {
        fg: 'blue',
        hover: {
          fg: 'white',
          bg: 'black'
        }
      },
      selected: {
        fg: 'white',
        bg: 'black'
      },
      prefix: {
        fg: 'white'
      }
    }
  });

  screen.on('prerender', function() {
    screen._.bar.setContent(utils.pad(screen.width));
  });

  screen._.sep = blessed.line({
    parent: screen._.wrapper,
    top: 1,
    left: 0,
    right: 0,
    orientation: 'horizontal'
  });

  var tabs = screen._.tabs = {};

  ['overview',
   'send',
   'addr',
   'tx',
   'recipients',
   'misc',
   'logs',
   'explore',
   'debug'].forEach(function(name) {
    if (name === 'debug' && !termcoin.config.debug) {
      return;
    }

    var tab = tabs[name] = blessed.box({
      top: 2,
      left: 0,
      right: 0,
      bottom: 0,
      scrollable: true,
      keys: true,
      vi: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' '
      },
      style: {
        scrollbar: {
          inverse: true
        }
      }
    });

    screen._.bar.addItem({
      text: name,
      callback: function() {
        // if (screen._.msg) screen._.msg.hide();
        if (screen._.target) screen._.target.detach();
        screen._.wrapper.append(tab);
        tab.focus();
        screen._.target = tab;
        screen.render();
      }
    });
  });

  screen._.bar.commands[0].callback();

  /**
   * Overview
   */

  tabs.overview._.wallet = blessed.text({
    parent: tabs.overview,
    top: 0,
    left: 3,
    height: 'shrink',
    width: '40%',
    label: ' {blue-fg}Wallet{/blue-fg} ',
    tags: true,
    border: {
      type: 'line'
    },
    content: 'No balance.',
    tags: true
  });

  tabs.overview._.transactions = blessed.text({
    parent: tabs.overview,
    top: 0,
    right: 3,
    height: 'shrink',
    label: ' {blue-fg}Transactions{/blue-fg} ',
    tags: true,
    border: {
      type: 'line'
    },
    content: 'No transactions.',
    tags: true
  });

  screen.on('resize', function callee() {
    if (screen.width < 103) {
      tabs.overview._.transactions.width = '40%';
      //tabs.overview._.transactions.shrink = false;
      screen.render();
      return callee;
    }
    tabs.overview._.transactions.width = undefined;
    delete tabs.overview._.transactions.position.width;
    //tabs.overview._.transactions.shrink = true;
    screen.render();
    return callee;
  }());

  tabs.overview._.data = blessed.box({
    parent: tabs.overview,
    bottom: 0,
    left: 3,
    height: 'shrink',
    width: '40%',
    label: ' {blue-fg}Data{/blue-fg} ',
    tags: true,
    border: 'line',
    content: 'Loading... ',
    style: {
      fg: 'lightblack',
      bar: {
        bg: 'blue'
      }
    }
  });

  tabs.overview._.bar = blessed.progressbar({
    parent: tabs.overview._.data,
    top: 3,
    left: 0,
    right: 0,
    height: 'shrink',
    orientation: 'horizontal',
    filled: 0,
    ch: '|',
    tags: true,
    //content: 'Syncing... ',
    style: {
      fg: 'lightblack',
      bar: {
        bg: 'blue'
      }
    }
  });

  (function self() {
    return bitcoin.getProgress(function(err, data) {
      if (data) {
        if (data.hoursBehind > 2) {
          tabs.overview._.wallet._label.setContent(
            ' {blue-fg}Wallet{/blue-fg} {red-fg}(Unsynced){/red-fg} ');
        } else {
          tabs.overview._.wallet._label.setContent(' {blue-fg}Wallet{/blue-fg} ');
        }
        tabs.overview._.data.setContent(
          'Connections: ' + data.connections + '\n'
          + (data.orphans != null ? 'Orphans: ' + data.orphans + '\n' : '')
          + 'Blocks: ' + data.blocks + ' (' + data.percent + '%)\n'
          + (data.daysBehind >= 1
          ? data.daysBehind + ' Days Behind'
          : data.hoursBehind + ' Hours Behind'));
        //tabs.overview._.bar.content = data.blocks + ' (' + data.percent + '%)';
        tabs.overview._.bar.setProgress(data.percent);
        screen.render();
      }
      setTimeout(self, 2000);
    });
  })();

  /**
   * Send
   */

  tabs.send.on('focus', function() {
    tabs.send._.form.resetSelected();
    tabs.send._.form.focus();
  });

  tabs.send._.form = blessed.form({
    parent: tabs.send,
    top: 0,
    left: 1,
    right: 1,
    bottom: 0,
    //height: 'shrink',
    keys: true,
    mouse: true,
    //label: ' {blue-fg}Send{/blue-fg} ',
    //border: 'line',
    tags: true,
    autoNext: true
  });

  tabs.send._.ttext = blessed.text({
    parent: tabs.send._.form,
    top: 0,
    left: 0,
    height: 1,
    content: 'Pay {ul}T{/ul}o:',
    tags: true
  });

  tabs.send._.address = blessed.textbox({
    parent: tabs.send._.form,
    name: 'address',
    inputOnFocus: true,
    top: 0,
    left: 9,
    right: 1,
    height: 1,
    style: {
      bg: 'black',
      focus: {
        bg: 'blue'
      },
      hover: {
        bg: 'blue'
      }
    }
  });

  tabs.send._.ltext = blessed.text({
    parent: tabs.send._.form,
    top: 2,
    left: 0,
    height: 1,
    content: ' {ul}L{/ul}abel:',
    tags: true
  });

  tabs.send._.label = blessed.textbox({
    parent: tabs.send._.form,
    name: 'label',
    inputOnFocus: true,
    top: 2,
    left: 9,
    right: 1,
    height: 1,
    style: {
      bg: 'black',
      focus: {
        bg: 'blue'
      },
      hover: {
        bg: 'blue'
      }
    }
  });

  tabs.send._.mtext = blessed.text({
    parent: tabs.send._.form,
    top: 4,
    left: 0,
    height: 1,
    content: 'A{ul}m{/ul}ount:',
    tags: true
  });

  tabs.send._.amount = blessed.textbox({
    parent: tabs.send._.form,
    name: 'amount',
    inputOnFocus: true,
    top: 4,
    left: 9,
    right: 1,
    height: 1,
    style: {
      bg: 'black',
      focus: {
        bg: 'blue'
      },
      hover: {
        bg: 'blue'
      }
    }
  });

  tabs.send._.ftext = blessed.text({
    parent: tabs.send._.form,
    top: 6,
    left: 0,
    height: 1,
    content: ' {ul}F{/ul}rom:',
    tags: true
  });

  tabs.send._.from = blessed.textbox({
    parent: tabs.send._.form,
    name: 'from',
    inputOnFocus: true,
    top: 6,
    left: 9,
    right: 1,
    height: 1,
    style: {
      bg: 'black',
      focus: {
        bg: 'blue'
      },
      hover: {
        bg: 'blue'
      }
    }
  });

  tabs.send._.submit = blessed.button({
    parent: tabs.send._.form,
    name: 'submit',
    top: 8,
    right: 1,
    height: 1,
    width: 'shrink',
    content: ' Send ',
    style: {
      bg: 'black',
      focus: {
        bg: 'blue'
      },
      hover: {
        bg: 'blue'
      }
    }
  });

  tabs.send._.note = blessed.text({
    parent: tabs.send._.form,
    //top: 10,
    bottom: 1,
    left: 0,
    height: 'shrink',
    right: 10,
    content: 'Press {blue-fg}Ctrl-E{/blue-fg} to select an address.'
        + ' The underlined shortcuts are available for each input.',
    tags: true
  });

  tabs.send._.submit.on('press', function() {
    tabs.send._.form.submit();
  });

  tabs.send._.form.on('submit', function(data) {
    // Technically shouldn't need a lock here since checkEncrypt executes the
    // callback synchronously (if decrypted) and the loader is invoked in that
    // callback, but just put this here for good measure.
    if (tabs.send._.lock) return;
    tabs.send._.lock = true;

    if (!data.address || !data.amount) {
      return screen._.msg.error('Please enter an address and amount.');
    }

    var alias = stats.addresses.reduce(function(out, item) {
      out[item.name] = item;
      return out;
    }, {});

    // Own addresses: for 'move' calls.
    alias = Object.keys(stats.accounts).reduce(function(out, key) {
      out[stats.accounts[key].name] = stats.accounts[key];
      return out;
    }, alias);

    if (data.address && alias[data.address]) {
      data.address = alias[data.address].address;
    }

    if (data.address && stats.accounts[data.address]) {
      data.move = true;
    }

    return checkEncrypt(function(err) {
      if (err) {
        tabs.send._.lock = false;
        return screen._.msg.error(err.message);
      }

      var checkLabel = function(callback) {
        if (!data.label) return callback();
        if (bitcoin.changeLabel) {
          return bitcoin.changeLabel(data.address, data.label, callback);
        }
        // setAccount, as of the latest bitcoind, cannot set labels for
        // addresses that aren't ours:
        // return bitcoin.setAccount(data.address, data.label, callback);
        return screen._.msg.error('Not supported.');
      };

      var sendTo = function(callback) {
        if (data.from) {
          // if (data.move) {
          //   return bitcoin.move(data.from, data.address, +data.amount, callback);
          // }
          return bitcoin.sendFrom(data.from, data.address, +data.amount, callback);
        }
        return bitcoin.send(data.address, +data.amount, callback);
      };

      screen._.loader.load('Sending {yellow-fg}'
        + data.amount + '{/yellow-fg} to {cyan-fg}'
        + data.address + '{/cyan-fg}...');

      return sendTo(function(err, result) {
        if (err || !result) {
          tabs.send._.lock = false;
          screen._.loader.stop();
          if (!err) {
            err = new Error('Transaction not completed.');
          }
          return screen._.msg.error(err.message);
        }

        return checkLabel(function(err) {
          tabs.send._.form.reset();
          tabs.send._.lock = false;
          screen._.loader.stop();
          screen._.msg.display(
            'Transaction completed successfully: '
            + result + '.');
        });
      });
    });
  });

  function pickAddress(callback) {
    var own = Object.keys(stats.accounts).map(function(key) {
      var item = stats.accounts[key];
      var out = '{cyan-fg}' + item.address + '{/cyan-fg}';
      if (item.name) {
        out += ' {green-fg}(' + item.name + '){/green-fg}';
      }
      return out;
    });

    var other = stats.addresses.map(function(item) {
      var out = '{cyan-fg}' + item.address + '{/cyan-fg}';
      if (item.name) {
        out += ' {green-fg}(' + item.name + '){/green-fg}';
      }
      return out;
    });

    var addr = own.concat(other);
    var addresses = [];

    addr.forEach(function(address) {
      if (!~addresses.indexOf(address)) {
        addresses.push(address);
      }
    });

    screen._.picker.setItems(addresses);

    return screen._.picker.pick(function(err, value) {
      if (err) return callback(err);
      if (value == null) return callback(null, value);
      var parts = value.replace(/{[^{}]+}/g, '').split(' ');
      var address = parts[0];
      var label = parts[1] ? parts[1].replace(/[()]/g, '') : '';
      return callback(null, address, label);
    });
  }

  function _pick(select) {
    var select = select || tabs.send._.form._selected;
    if (select !== tabs.send._.address && select !== tabs.send._.from) {
      select = tabs.send._.address;
    }
    return pickAddress(function(err, address, label) {
      if (err) return screen._.msg.error(err.message);
      if (address == null) return screen.render();
      if (label && select === tabs.send._.address) {
        tabs.send._.label.setValue(label);
      }
      if (select === tabs.send._.from) {
        select.setValue(label);
      } else {
        select.setValue(address);
      }
      select.focus();
      tabs.send._.form._selected = select;
      return screen.render();
    });
  }

  tabs.send._.form.on('element key escape', function() {
    tabs.send._.form.resetSelected();
  });

  tabs.send._.form.key(['C-e', 'e'], function() {
    tabs.send._.address.focus();
    _pick(tabs.send._.address);
  });

  tabs.send._.form.key(['T', 't'], function() {
    tabs.send._.address.focus();
    _pick(tabs.send._.address);
  });

  tabs.send._.form.key(['M', 'm'], function() {
    tabs.send._.amount.focus();
  });

  tabs.send._.form.key(['L', 'l'], function() {
    tabs.send._.label.focus();
  });

  tabs.send._.form.key(['F', 'f'], function() {
    tabs.send._.from.focus();
    _pick(tabs.send._.from);
  });

  /**
   * Addresses
   */

  tabs.addr.on('focus', function() {
    tabs.addr._.list.focus();
  });

  tabs.addr._.list = blessed.listtable({
    parent: tabs.addr,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      scrollbar: {
        inverse: true
      },
      header: {
        bold: true
      },
      cell: {
        selected: {
          bg: 'blue'
        }
      },
      item: {
        hover: {
          bg: 'blue'
        }
      }
    },
    scrollbar: {
      ch: ' '
    }
  });

  tabs.addr._.list.key('d', function() {
    deleteAddress();
  });

  function deleteAddress() {
    var list = tabs.addr._.list
      , el = list.items[list.selected];

    var parts = el.getText().trim().split(/\s+/)
      , label = parts[0]
      , balance = parts[1].replace(/[()]/g, '')
      , address = parts[2];

    return screen._.question.ask('Are you sure you want to delete this?', function(err, value) {
      if (err) return screen._.msg.error(err.message);
      if (!value) return screen.render();

      if (!bitcoin.deleteAccount) {
        return screen._.msg.error('Not supported.');
      }

      return bitcoin.deleteAccount(address, function(err) {
        if (err) return screen._.msg.error(err.message);
        var text = 'Deleted address: {blue-fg}' + address + '{/blue-fg}';
        screen._.msg.display(text);
        screen.render();
        return refresh();
      });
    });
  }

  tabs.addr._.list.on('select', function(el, index) {
    var parts = el.getText().trim().split(/\s+/)
      , label = parts[0]
      , balance = parts[1] ? parts[1].replace(/[()]/g, '') : null
      , address = parts[2]
      , text;

    if (label === 'New') {
      return checkEncrypt(function(err) {
        if (err) return screen._.msg.error(err.message);
        text = 'Label for new address:';
        return screen._.prompt.input(text, '', function(err, value) {
          if (err) return screen._.msg.error(err.message);
          if (value == null) return screen.render();
          return bitcoin.createAddress(value, function(err, address) {
            if (err) return screen._.msg.error(err.message);
            text = 'Created address: {blue-fg}' + address + '{/blue-fg}';
            screen._.msg.display(text);
            screen.render();
            return refresh();
          });
        });
      });
    }

    screen._.picker.setItems([
      // 'Show Transactions',
      // 'Received By',
      'View Blockchain',
      'Copy Address',
      'Copy Label',
      'Rename',
      'Delete',
      //'-',
      'Send From',
      'Show QR Code',
      'Save QR Code PNG',
      'Sign Message'
    ]);

    return screen._.picker.pick(function(err, option) {
      if (err) return screen._.msg.error(err.message);

      if (option === 'View Blockchain') {
        return tabs.explore._.view(address);
      }

      if (option === 'Copy Address') {
        return ui.copy(address);
      }

      if (option === 'Copy Label') {
        return ui.copy(label);
      }

      if (option === 'Rename') {
        text = 'Label for {blue-fg}' + address + '{/blue-fg}:';
        return screen._.prompt.input(text, '', function(err, newLabel) {
          if (err) return screen._.msg.error(err.message);

          if (newLabel == null) return screen.render();

          if (!bitcoin.changeLabel) {
            return screen._.msg.error('Not supported.');
          }

          // Does not associate address with new account name, just creates a
          // new account with a new address.
          // return bitcoin.setAccount(address, newLabel, function(err) {

          return bitcoin.changeLabel(address, newLabel, function(err) {
            if (err) return screen._.msg.error(err.message);
            text = 'Edited label: {blue-fg}'
              + label + '->' + (newLabel || '[none]') + '{/blue-fg}';
            screen._.msg.display(text);
            screen.render();
            return refresh();
          });
        });
      }

      if (option === 'Delete') {
        return deleteAddress();
      }

      if (option === 'Send From') {
        screen._.bar.selectTab(1);
        tabs.send._.from.setValue(label);
        tabs.send._.form.focusFirst();
        screen.render();
        return;
      }

      if (option === 'Show QR Code') {
        var code = 'bitcoin:' + address + '?label=' + encodeURIComponent(label);
        text = 'Optional message for QR code:';
        return screen._.prompt.input(text, '', function(err, msg) {
          if (err) return screen._.msg.error(err.message);
          if (label) {
            code += '&message=' + encodeURIComponent(msg);
          }
          return cp.execFile('qrencode', ['-t', 'ANSI256', code], function(err, stdout, stderr) {
            if (err) {
              return screen._.msg.error('qrencode not found. Please install it.');
            }
            return screen._.qrbox._.show(stdout.trim());
          });
        });
      }

      if (option === 'Save QR Code PNG') {
        return screen._.prompt.input('Save to:', '~/', function(err, file) {
          if (err) return screen._.msg.error(err.message);
          if (file == null) return screen.render();
          file = file.replace(/^~/, process.env.HOME);
          var code = 'bitcoin:' + address + '?label=' + encodeURIComponent(label);
          text = 'Optional message for QR code:';
          return screen._.prompt.input(text, '', function(err, msg) {
            if (err) return screen._.msg.error(err.message);
            if (label) {
              code += '&message=' + encodeURIComponent(msg);
            }
            return cp.execFile('qrencode', ['-t', 'PNG', '-o', file, code], function(err, stdout, stderr) {
              if (err) {
                return screen._.msg.error('qrencode not found. Please install it.');
              }
              return screen._.msg.display('Successfully saved file.');
            });
          });
        });
      }

      if (option === 'Sign Message') {
        screen._.bar.selectTab(5);
        tabs.misc._.list.enterSelected(3);
        var i = screen._.picker.ritems.indexOf(address);
        if (!~i) i = screen._.picker.ritems.indexOf(label);
        if (!~i) return;
        screen._.picket.enterSelected(i);
        screen.render();
        return;
      }

      if (option === 'Received By') {
        return bitcoin.listReceivedByAddress(address, function(err, txs) {
          return;
        });
      }
    });
  });

  /**
   * Transactions
   */

  tabs.tx.on('focus', function() {
    tabs.tx._.list.focus();
  });

  tabs.tx._.list = blessed.listtable({
    parent: tabs.tx,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // border: {
    //   type: 'line',
    //   top: false,
    //   left: false,
    //   right: false,
    //   bottom: false
    // },
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    items: [
      'Loading...'
    ],
    style: {
      scrollbar: {
        inverse: true
      },
      header: {
        bold: true
      },
      cell: {
        selected: {
          bg: 'blue'
        },
        item: {
          hover: {
            bg: 'blue'
          }
        }
      }
    },
    scrollbar: {
      ch: ' '
    }
  });

  tabs.tx._.list.on('select', function(el, index) {
    var tx = tabs.tx._.list._.ids[index - 1];
    if (!tx) return;

    screen._.picker.setItems([
      'Details',
      // 'Block Details',
      'View Blockchain',
      'Copy Address',
      'Copy Label',
      'Copy Amount',
      'Edit Label'
    ]);

    return screen._.picker.pick(function(err, option) {
      if (err) return screen._.msg.error(err.message);

      if (option === 'Copy Address') {
        var address = bitcoin.txData(tx).addr;
        return ui.copy(address);
      }

      if (option === 'Copy Label') {
        var label = coin.accountByAddress(bitcoin.txData(tx).addr).label;
        return ui.copy(label);
      }

      if (option === 'Copy Amount') {
        return ui.copy(bcoin.utils.toBTC(tx.funds('in')));
      }

      if (option === 'Edit Label') {
        return;
      }

      if (option === 'Details') {
        var getTransaction = function(id, callback) {
          if (opt.mock) {
            return callback(null, mock.transaction);
          }
          return bitcoin.getTransaction(id, callback);
        };

        return getTransaction(tx.rhash, function(err, tx) {
          if (err) return screen._.msg.error(err.message);

          coined.utils.hideProperty(tx, '_noRefresh', true);

          return tabs.explore._.view({
            type: 'tx',
            value: tx
          });
        });
      }

      if (option === 'Block Details') {
        var getBlock = function(id, callback) {
          if (opt.mock) {
            return callback(null, mock.block);
          }
          return bitcoin.getBlock(id, callback);
        };

        return getBlock(tx.rblock, function(err, block) {
          if (err) return screen._.msg.error(err.message);

          coined.utils.hideProperty(block, '_noRefresh', true);
          return tabs.explore._.view({
            type: 'block',
            value: block
          });
        });
      }

      if (option === 'View Blockchain') {
        return tabs.explore._.view(tx.rhash);
      }
    });
  });

  /**
   * Recipients
   */

  tabs.recipients.on('focus', function() {
    tabs.recipients._.list.focus();
  });

  tabs.recipients._.list = blessed.listtable({
    parent: tabs.recipients,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      scrollbar: {
        inverse: true
      },
      header: {
        bold: true
      },
      cell: {
        selected: {
          bg: 'blue'
        }
      },
      item: {
        hover: {
          bg: 'blue'
        }
      }
    },
    scrollbar: {
      ch: ' '
    }
  });

  tabs.recipients._.list.key('d', function() {
    deleteSendAddress();
  });

  function deleteSendAddress() {
    var list = tabs.recipients._.list
      , el = list.items[list.selected];

    var parts = el.getText().trim().split(/\s+/)
      , label = parts[0]
      , address = parts[1];

    screen._.question.ask('Are you sure you want to delete this?', function(err, value) {
      if (err) return screen._.msg.error(err.message);
      if (!value) return screen.render();

      if (!bitcoin.deleteAccount) {
        return screen._.msg.error('Not supported.');
      }

      // return bitcoin.setAccount(address, function(err) {
      return bitcoin.deleteAccount(address, function(err) {
        if (err) return screen._.msg.error(err.message);
        text = 'Deleted address: {blue-fg}' + address + '{/blue-fg}';
        screen._.msg.display(text);
        screen.render();
        return refresh();
      });
    });
  }

  tabs.recipients._.list.on('select', function(el, index) {
    var parts = el.getText().trim().split(/\s+/)
      , label = parts[0]
      , address = parts[1]
      , text;

    if (label === 'New') {
      text = 'Label for new address:';
      return screen._.prompt.input(text, '', function(err, label) {
        if (err) return screen._.msg.error(err.message);
        if (!label) return screen.render();
        text = 'Address:';
        return screen._.prompt.input(text, '', function(err, address) {
          if (err) return screen._.msg.error(err.message);
          if (!address) return screen.render();
          return bitcoin.setAccount(address, label, function(err) {
            if (err) return screen._.msg.error(err.message);
            text = 'Created address: {blue-fg}' + label + '{/blue-fg}';
            screen._.msg.display(text);
            screen.render();
            return refresh();
          });
        });
      });
    }

    screen._.picker.setItems([
      'View Blockchain',
      'Copy Address',
      'Copy Label',
      'Rename',
      'Delete',
      //'-',
      'Send Coins',
      'Show QR Code',
      'Save QR Code PNG',
      'Verify Message'
    ]);

    return screen._.picker.pick(function(err, option) {
      if (err) return screen._.msg.error(err.message);

      if (option === 'View Blockchain') {
        return tabs.explore._.view(address);
      }

      if (option === 'Copy Address') {
        return ui.copy(address);
      }

      if (option === 'Copy Label') {
        return ui.copy(label);
      }

      if (option === 'Rename') {
        text = 'Label for {blue-fg}' + address + '{/blue-fg}:';
        return screen._.prompt.input(text, label, function(err, newLabel) {
          if (err) return screen._.msg.error(err.message);
          if (!newLabel) return screen.render();

          if (!bitcoin.changeLabel) {
            return screen._.msg.error('Not supported.');
          }

          // return bitcoin.setAccount(address, newLabel, function(err) {
          return bitcoin.changeLabel(address, newLabel, function(err) {
            if (err) return screen._.msg.error(err.message);
            text = 'Edited label: {blue-fg}'
              + label + '->' + (newLabel || '[none]') + '{/blue-fg}';
            screen._.msg.display(text);
            screen.render();
            return refresh();
          });
        });
      }

      if (option === 'Delete') {
        return deleteSendAddress();
      }

      if (option === 'Send Coins') {
        screen._.bar.selectTab(1);
        tabs.send._.address.setValue(address);
        tabs.send._.form.focusFirst();
        screen.render();
        return;
      }

      if (option === 'Show QR Code') {
        var code = 'bitcoin:' + address + '?label=' + encodeURIComponent(label);
        text = 'Optional message for QR code:';
        return screen._.prompt.input(text, '', function(err, msg) {
          if (err) return screen._.msg.error(err.message);
          if (label) {
            code += '&message=' + encodeURIComponent(msg);
          }
          return cp.execFile('qrencode', ['-t', 'ANSI256', code], function(err, stdout, stderr) {
            if (err) {
              return screen._.msg.error('qrencode not found. Please install it.');
            }
            screen._.qrbox._.show(stdout.trim());
          });
        });
      }

      if (option === 'Save QR Code PNG') {
        return screen._.prompt.input('Save to:', '~/', function(err, file) {
          if (err) return screen._.msg.error(err.message);
          if (file == null) return screen.render();
          file = file.replace(/^~/, process.env.HOME);
          var code = 'bitcoin:' + address + '?label=' + encodeURIComponent(label);
          text = 'Optional message for QR code:';
          return screen._.prompt.input(text, '', function(err, msg) {
            if (err) return screen._.msg.error(err.message);
            if (label) {
              code += '&message=' + encodeURIComponent(msg);
            }
            return cp.execFile('qrencode', ['-t', 'PNG', '-o', file, code], function(err, stdout, stderr) {
              if (err) {
                return screen._.msg.error('qrencode not found. Please install it.');
              }
              return screen._.msg.display('Successfully saved file.');
            });
          });
        });
      }

      if (option === 'Verify Message') {
        tabs.misc._.list.enterSelected(2);
        screen._.prompt._.input.setValue(address);
        screen._.prompt._.input.enterSelected();
        screen.render();
        return;
      }
    });
  });

  /**
   * Misc
   */

  tabs.misc._.list = blessed.list({
    parent: tabs.misc,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      scrollbar: {
        inverse: true
      },
      selected: {
        bg: 'blue'
      },
      item: {
        hover: {
          bg: 'blue'
        }
      }
    },
    scrollbar: {
      ch: ' '
    },
    items: [
      'Encrypt Wallet',
      'Unencrypt Wallet',
      'Backup Wallet',
      'Verify Message Signature',
      'Sign Message',
      'Set Transaction Fee',
      'Import Private Key',
      'Dump Private Key',
      'Import Wallet',
      'Dump Wallet',
      'Refill Key Pool',
      'Toggle Coin Generation',
      'Get Mining Info',
      'Rescan Blockchain',
      'Scan QR Code (X11+Linux)'
    ]
  });

  tabs.misc.on('focus', function() {
    tabs.misc._.list.focus();
  });

  process.on('uncaughtException', function(err) {
    if (ui.lock) return;
    screen.leave();
    console.error(err.stack);
    process.exit(1);
  });

  tabs.misc._.list.on('select', function(el, index) {
    var text = el.getText();

    if (text === 'Encrypt Wallet') {
      return bitcoin.isEncrypted(function(err, encrypted) {
        if (err) return screen._.msg.error(err.message);
        if (encrypted) {
          screen._.prompt._.input.censor = true;
          return screen._.prompt.input('Current Passphrase:', '', function(err, opassphrase) {
            screen._.prompt._.input.censor = false;
            if (err) return screen._.msg.error(err.message);
            if (opassphrase == null) return screen.render();
            screen._.prompt._.input.censor = true;
            return screen._.prompt.input('New passphrase:', '', function(err, npassphrase) {
              screen._.prompt._.input.censor = false;
              if (err) return screen._.msg.error(err.message);
              if (npassphrase == null) return screen.render();
              screen._.prompt._.input.censor = true;
              return screen._.prompt.input('Verify Passphrase:', '', function(err, verify) {
                screen._.prompt._.input.censor = false;
                if (err) return screen._.msg.error(err.message);
                if (verify == null) return screen.render();
                if (npassphrase !== verify) {
                  return screen._.msg.error('Passphrases do not match.');
                }
                return bitcoin.changePassphrase(opassphrase, npassphrase, function(err) {
                  if (err) return screen._.msg.error(err.message);
                  return screen._.msg.display('Passphrase changed.');
                });
              });
            });
          });
        }
        screen._.prompt._.input.censor = true;
        return screen._.prompt.input('Passphrase:', '', function(err, passphrase) {
          screen._.prompt._.input.censor = false;
          if (err) return screen._.msg.error(err.message);
          if (passphrase == null) return screen.render();
          screen._.prompt._.input.censor = true;
          return screen._.prompt.input('Verify Passphrase:', '', function(err, verify) {
            screen._.prompt._.input.censor = false;
            if (err) return screen._.msg.error(err.message);
            if (verify == null) return screen.render();
            if (passphrase !== verify) {
              return screen._.msg.error('Passphrases do not match.');
            }
            screen.render();
            return bitcoin.encryptWallet(passphrase, function(err) {
              if (err) return screen._.msg.error(err.message);
              if (termcoin.config.libbitcoind) {
                return setTimeout(function() {
                  screen._.loader.load('Stopping bitcoind...');
                  return setTimeout(function() {
                    screen._.loader.stop();
                    return exit();
                  }, 2000);
                }, 3000);
              }
              if (opt.remote) {
                return screen._.msg.display('Wallet is now encrypted.');
              }
              if (!bitcoin.restart) {
                return screen._.msg.display('Wallet is now encrypted.');
              }
              ui.lock = true;
              screen._.loader.load('Restarting server...');
              return setTimeout(function() {
                return fs.unlink(platform.pid, function() {
                  return bitcoin.startServer(function() {
                    ui.lock = false;
                    return bitcoin.decryptWallet(passphrase, 60 * 60, function() {
                      screen._.loader.stop();
                      ui.decryptTime = Date.now();
                      return screen._.msg.display('Wallet is now encrypted.');
                    });
                  });
                });
              }, 10000);
            });
          });
        });
      });
    }

    if (text === 'Unencrypt Wallet') {
      if (!bitcoin.unencryptWallet) {
        return screen._.msg.error('unencryptWallet not supported on this platform.');
      }
      screen._.prompt._.input.censor = true;
      return screen._.prompt.input('Passphrase:', '', function(err, passphrase) {
        screen._.prompt._.input.censor = false;
        if (err) return screen._.msg.error(err.message);
        if (passphrase == null) return screen.render();
        return bitcoin.unencryptWallet(passphrase, function(err) {
          if (err) return screen._.msg.error(err.message);
          screen._.msg.display('Wallet unencrypted (permanently),');
        });
      });
    }

    if (text === 'Backup Wallet') {
      return screen._.prompt.input('Save to:', '~/', function(err, file) {
        if (err) return screen._.msg.error(err.message);
        if (file == null) return screen.render();

        file = file.replace(/^~/, process.env.HOME);

        var stat;
        try {
          stat = fs.statSync(file);
        } catch (e) {
          ;
        }

        if (stat && stat.isDirectory()) {
          file = file.replace(/\/+$/, '') + '/wallet.dat.bak';
        }

        return bitcoin.backupWallet(file, function(err) {
          if (err) return screen._.msg.error(err.messsage);
          screen._.msg.display('Wallet successfully backed up.');
          screen.render();
        });
      });
    }

    if (text === 'Verify Message Signature') {
      return screen._.prompt.input('Address (Ctrl-E to select):', '', function(err, address) {
        if (err) return screen._.msg.error(err.message);
        if (address == null) return screen.render();
        return screen._.prompt.input('Signature:', '', function(err, sig) {
          if (err) return screen._.msg.error(err.message);
          if (sig == null) return screen.render();
          return screen._.prompt.input('Message:', '', function(err, message) {
            if (err) return screen._.msg.error(err.message);
            if (message == null) return screen.render();
            return bitcoin.verifyMessage(address, sig, message, function(err, result) {
              if (err) return screen._.msg.error(err.message);
              if (!result) {
                return screen._.msg.error('Not verified.');
              }
              return screen._.msg.display('Verified!');
            });
          });
        });
      });
    }

    if (text === 'Sign Message') {
      return checkEncrypt(function(err) {
        if (err) return screen._.msg.error(err.message);
        screen._.picker.setItems(Object.keys(stats.accounts));
        return screen._.picker.pick(function(err, address) {
          if (err) return screen._.msg.error(err.message);
          if (address == null) return screen.render();
          return screen._.prompt.input('Message:', '', function(err, message) {
            if (err) return screen._.msg.error(err.message);
            if (message == null) return screen.render();
            return bitcoin.signMessage(address, message, function(err, signature) {
              if (err) return screen._.msg.error(err.message);
              if (signature == null) return screen.render();
              return screen._.msg.display('Signature:\n' + signature, -1);
            });
          });
        });
      });
    }

    if (text === 'Set Transaction Fee') {
      return screen._.prompt.input('Transaction Fee:', '0', function(err, value) {
        if (err) return screen._.msg.error(err.message);
        if (value == null) return screen.render();
        return bitcoin.setTxFee(+value, function(err) {
          if (err) return screen._.msg.error(err.message);
          return screen._.msg.display('Successfully set transaction fee.');
        });
      });
    }

    if (text === 'Import Private Key') {
      return checkEncrypt(function(err) {
        if (err) return screen._.msg.error(err.message);
        return screen._.prompt.input('Key:', '', function(err, key) {
          if (err) return screen._.msg.error(err.message);
          if (key == null) return screen.render();
          return screen._.prompt.input('Label:', '', function(err, label) {
            if (err) return screen._.msg.error(err.message);
            if (label == null) return screen.render();
            return screen._.question.ask('Rescan?', function(err, rescan) {
              if (err) return screen._.msg.error(err.message);
              if (rescan) {
                screen._.loader.load('Rescanning (this may take a while)...');
              }
              return bitcoin.importPrivKey(key, label, !!rescan, function(err) {
                if (rescan) screen._.loader.stop();
                if (err) return screen._.msg.error(err.message);
                return screen._.msg.display('Successfully set transaction fee.');
              });
            });
          });
        });
      });
    }

    if (text === 'Dump Private Key') {
      return checkEncrypt(function(err) {
        if (err) return screen._.msg.error(err.message);
        screen._.picker.setItems(Object.keys(stats.accounts));
        return screen._.picker.pick(function(err, address) {
          if (err) return screen._.msg.error(err.message);
          if (address == null) return screen.render();
          return bitcoin.dumpPrivKey(address, function(err, key) {
            if (err) return screen._.msg.error(err.message);
            return screen._.msg.display('Private Key: ' + key);
          });
        });
      });
    }

    if (text === 'Import Wallet') {
      return checkEncrypt(function(err) {
        if (err) return screen._.msg.error(err.message);
        screen._.loader.load('Loading...');
        return bitcoin.importWallet(file, function(err) {
          screen._.loader.stop();
          if (err) return screen._.msg.error(err.message);
          return screen._.msg.display(file + ' successfully imported.');
        });
      });
    }

    if (text === 'Dump Wallet') {
      return checkEncrypt(function(err) {
        if (err) return screen._.msg.error(err.message);
        var file = process.env.HOME + '/wallet.dump';
        screen._.loader.load('Loading...');
        return bitcoin.dumpWallet(file, function(err) {
          screen._.loader.stop();
          if (err) return screen._.msg.error(err.message);
          return screen._.msg.display('Wallet dump to: ' + file);
        });
      });
    }

    if (text === 'Refill Key Pool') {
      return checkEncrypt(function(err) {
        if (err) return screen._.msg.error(err.message);
        screen._.loader.load('Refilling key pool...');
        return bitcoin.keyPoolRefill(function(err) {
          screen._.loader.stop();
          if (err) return screen._.msg.error(err.message);
          return screen._.msg.display('Key pool refill complete.');
        });
      });
    }

    if (text === 'Toggle Coin Generation') {
      return bitcoin.getGenerate(function(err, generating) {
        if (err) return screen._.msg.error(err.message);
        if (generating) {
          return bitcoin.setGenerate(false, function(err, key) {
            if (err) return screen._.msg.error(err.message);
            return screen._.msg.display('Stopped mining.');
          });
        }
        return screen._.prompt.input('Threads? (-1 for no. of cores)', '1', function(err, threads) {
          if (err) return screen._.msg.error(err.message);
          return bitcoin.setGenerate(true, +threads, function(err, key) {
            if (err) return screen._.msg.error(err.message);
            return screen._.msg.display('Mining!');
          });
        });
      });
    }

    if (text === 'Get Mining Info') {
      return bitcoin.getMiningInfo(function(err, info) {
        if (err) return screen._.msg.error(err.message);
        return screen._.msg.display(utils.inspect(info), -1);
      });
    }

    if (text === 'Rescan Blockchain') {
      if (!bitcoin.rescan) {
        return screen._.msg.error('Rescan not implemented.');
      }
      screen._.loader.load('Rescanning (this may take a while)...');
      return bitcoin.rescan({}, function(err) {
        screen._.loader.stop();
        if (err) return screen._.msg.error(err.message);
        return screen._.msg.display('Successfully rescanned blockchain.');
      });
    }

    if (text === 'Scan QR Code (X11+Linux)') {
      return scanQR(function(err, data) {
        if (err) {
          return screen._.msg.error(
            'zbarcam is either uninstalled or failed:\n\n'
            + err.message);
        }
        data = data.replace(/^bitcoin:/, '');
        return screen._.msg.display(data, -1);
      });
    }
  });

  /**
   * Logs
   */

  tabs.logs.on('focus', function() {
    if (tabs.logs._.tail) return;
    tabs.logs._.tail = tailBox(platform.log, tabs.logs);
  });

  tabs.logs.on('blur', function() {
    if (tabs.logs._.tail) {
      tabs.logs._.tail();
      delete tabs.logs._.tail;
    }
  });

  /**
   * Explore
   */

  require('./explore/ui');

  /**
   * Debug
   */

  if (termcoin.config.debug) {
    tabs.debug._.data = blessed.text({
      parent: tabs.debug,
      top: 0,
      left: 3,
      height: 'shrink',
      width: 'shrink',
      content: '',
      tags: true
    });
  }

  /**
   * Global Widgets
   */

  screen._.prompt = blessed.prompt({
    parent: screen,
    top: 'center',
    left: 'center',
    height: 'shrink',
    width: 'shrink',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    content: 'Label:',
    border: 'line',
    hidden: true
  });

  screen._.prompt._.input.key('C-e', function() {
    if (!screen.focused || screen.focused !== screen._.prompt._.input) {
      return;
    }
    var selected = tabs.misc._.list.selected;
    screen._.prompt._.cancel.press();
    return pickAddress(function(err, address, label) {
      if (err) return screen._.msg.error(err.message);
      if (address == null) return screen.render();
      tabs.misc._.list.emit('select', tabs.misc._.list.items[selected], selected);
      screen._.prompt._.input.setValue(address);
      return screen.render();
    });
  });

  screen._.question = blessed.question({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 'shrink',
    height: 'shrink',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    content: 'Label:',
    border: 'line',
    hidden: true
  });

  screen._.fm = blessed.filemanager({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '70%',
    height: '50%',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    label: ' Choose a file... ',
    border: 'line',
    hidden: true
  });

  screen._.picker = blessed.list({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '70%',
    height: '50%',
    border: 'line',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    hidden: true,
    style: {
      scrollbar: {
        inverse: true
      },
      selected: {
        bg: 'blue'
      },
      item: {
        hover: {
          bg: 'blue'
        }
      }
    },
    scrollbar: {
      ch: ' '
    }
  });

  /**
   * Loader
   */

  screen._.loader = blessed.loading({
    parent: screen,
    top: 'center',
    left: 'center',
    height: 5,
    align: 'center',
    width: '50%',
    tags: true,
    hidden: true,
    border: 'line'
  });

  /**
   * Message
   */

  screen._.msg = blessed.message({
    parent: screen,
    top: 'center',
    left: 'center',
    // Fixed in blessed:
    // height: '50%',
    height: 'shrink',
    width: '50%',
    align: 'center',
    tags: true,
    hidden: true,
    border: 'line',
    // "q" will not make the box disappear on display()
    ignoreKeys: ['q']
  });

  /**
   * Details
   */

  screen._.details = blessed.message({
    parent: screen,

    // Fixed in blessed.
    // top: 'center',
    // left: 'center',
    // height: 'shrink',
    // width: 'shrink',

    //top: 2,
    //left: 4,
    //right: 4,
    //bottom: 2,

    top: 'center',
    left: 'center',
    width: '70%',
    height: '50%',

    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    hidden: true,
    border: 'line',
    scrollbar: {
      ch: ' '
    },
    style: {
      scrollbar: {
        bg: 'blue'
      }
    }
  });

  /**
   * QR Box
   */

  screen._.qrbox = blessed.box({
    parent: screen,
    scrollable: true,
    alwaysScroll: true,
    //top: 0,
    //left: 0,
    //bottom: 0,
    //right: 0,

    top: 1,
    bottom: 1,
    width: 80 + 6,
    //width: 'shrink',
    left: 'center',
    border: 'line',

    align: 'center',
    tags: true,
    hidden: true,
    keys: true,
    vi: true,
    scrollbar: {
      ch: ' '
    },
    style: {
      scrollbar: {
        inverse: true
      }
    }
  });

  screen._.qrbox._.show = function(content) {
    screen.saveFocus();
    screen._.qrbox.focus();
    screen._.qrbox.setScroll(0);
    screen._.qrbox.setContent(content);
    screen._.qrbox.show();
    screen.render();
  };

  screen._.qrbox.key(['q', 'escape'], function() {
    screen._.qrbox.hide();
    screen.restoreFocus();
    screen.render();
  });

  if (!stats.encrypted) {
    screen._.msg.display('Welcome to {blue-fg}termcoin{/blue-fg}!', 2);
    //screen._.msg._.img = blessed.image({
    //  parent: screen._.msg,
    //  autofit: true,
    //  top: 0,
    //  left: 0,
    //  file: __dirname + '/img/logo.png'
    //});
  }

  function checkEncrypt(callback) {
    if (!stats.encrypted) {
      return callback();
    }

    if (!termcoin.config.libbitcoind) {
      if (ui.decryptTime && ui.decryptTime + 60 * 60 * 1000 > Date.now()) {
        return callback();
      }
    }

    screen._.prompt._.input.censor = true;
    return screen._.prompt.input('Enter your passphrase (valid for 60 min):', '', function(err, value) {
      screen._.prompt._.input.censor = false;
      if (err) {
        screen.render();
        return callback(err);
      }
      if (value == null) {
        return screen.render();
      }
      return bitcoin.forgetKey(function() {
        return bitcoin.decryptWallet(value, 60 * 60, function(err) {
          if (err) {
            screen.render();
            return callback(err);
          }
          ui.decryptTime = Date.now();
          screen.render();
          return callback(null);
        });
      });
    });
  }

  function refresh(callback, showLoad) {
    if (refresh.lock) {
      if (callback) callback();
      return;
    }

    var done = function(err) {
      refresh.lock = false;
      if (!callback) return;
      return err
        ? callback(err)
        : callback();
    };

    refresh.lock = true;

    // Disable this functionality:
    // showLoad = false;
    refresh.lock = false;

    if (ui.lock) return done();

    if (screen._.prompt.visible
        || screen._.question.visible
        || screen._.msg.visible
        || screen._.loader.visible) {
      showLoad = false;
    }

    if (showLoad) {
      screen._.loader.load('Loading...');
    }

    return bitcoin.getStats(function(err, stats_) {
      if (ui.lock) {
        if (showLoad) screen._.loader.stop();
        return done();
      }

      if (err) {
        if (showLoad) screen._.loader.stop();
        return done(err);
      }

      stats = stats_;

      var items;

      // Wallet
      tabs.overview._.wallet.setContent(
        '{blue-fg}Balance:{/blue-fg}     {yellow-fg}'
        + (+stats.balance.balance).toFixed(8) + '{/yellow-fg}\n'
        + '{red-fg}Unconfirmed:{/red-fg} {yellow-fg}'
        + (+stats.balance.unconfirmed).toFixed(8) + '{/yellow-fg}');

      // Accounts
      var accounts = Object.keys(stats.accounts).map(function(key) {
        return stats.accounts[key];
      });
      accounts = utils.asort(accounts);
      items = [['Name', 'Balance', 'Address']];
      items.push(['New', '', '']);
      accounts.forEach(function(account) {
        var w = screen.width;
        var name = account.name || '[none]';
        var balance = '(' + (+account.balance).toFixed(8) + ') ';
        items.push([
          '{blue-fg}' + name + '{/blue-fg}',
          '{yellow-fg}' + balance + '{/yellow-fg}',
          '{green-fg}' + account.address + '{/green-fg}'
        ]);
      });
      tabs.addr._.list.setData(items);

      function ensure8(value) {
        var amount = bcoin.utils.toBTC(value);
        var dec = (amount.split('.')[1] || '').length;
        while (dec++ < 8)
          amount += '0';
        return amount;
      }

      // Transactions
      if (stats.transactions.length > tabs.tx._.list.ritems.length
          && stats.transactions[0].role === 'recipient') {
        screen.program.bel();
      }

      items = [[
        'ID',
        'Date',
        'Amount',
        'Address',
        'Confirmations'
      ]];
      stats.transactions.forEach(function(tx) {
        var text;
        var time = tx.ts || (Date.now() / 1000 | 0);
        var date = new Date(time * 1000).toISOString().split('T')[0];
        var txd = bitcoin.txData(tx);
        var amount = ensure8(txd.value);
        // XXX NEGATIVE - why is this.funds('in') zero when role is recipient?
        var fee = ensure8(tx.getFee());
        var addr = txd.addr;
        // while (addr.length < 35) addr += ' ';
        text = [
          tx.rhash.substring(0, 6),
          '{white-fg}' + date + '{/white-fg}',
          (txd.role === 'sender'
            ? '{red-fg}{bold}-' + amount + '{/bold}{/red-fg}'
            : '{green-fg}{bold}+' + amount + '{/bold}{/green-fg}'),
          // '({red-fg}' + (fee ? fee : 0..toFixed(8)) + '{/red-fg})',
          '{cyan-fg}' + addr + '{/cyan-fg}',
          (tx.confirmations < 3
            ? '{red-fg}{bold}(' + tx.confirmations + '){/bold}{/red-fg}'
            : '{green-fg}{bold}(' + tx.confirmations + '){/bold}{/green-fg}')
        ];
        items.push(text);
        return items;
      }, []);

      if (items.length === 1) {
        items = [['Transactions']];
        items.push(['No transactions available yet.']);
        tabs.tx._.list.__align = 'left';
      } else {
        tabs.tx._.list.__align = 'center';
      }

      tabs.tx._.list.setData(items);
      tabs.tx._.list._.ids = stats.transactions.slice();

      items = stats.transactions.slice(0, 3).map(function(tx) {
        if (!tx) return;
        var sep = ' ';
        var txd = bitcoin.txData(tx);
        var amount = ensure8(txd.value);
        var addr = txd.addr;
        while (addr.length < 35) addr += ' ';
        return '{green-fg}' + addr + '{/green-fg}'
          + sep
          + (txd.role === 'sender'
            ? '{red-fg}{bold}<- ' + amount  + '{/bold}{/red-fg}'
            : '{green-fg}{bold}<- ' + amount  + '{/bold}{/green-fg}')
          + sep
          + (tx.confirmations < 3
            ? '{red-fg}(' + tx.confirmations + '){/red-fg}'
            : '{green-fg}(' + tx.confirmations + '){/green-fg}');
      }).filter(Boolean).join('\n');
      if (items) {
        tabs.overview._.transactions.setContent(items);
      }

      // Recipients
      var addresses = utils.asort(stats.addresses);
      items = [['Name', 'Address']];
      items.push(['New', '', '']);
      addresses.forEach(function(account) {
        var w = screen.width;
        var name = account.name || '[none]';
        var sp = utils.pad(w - (account.address.length + name.length) - 3);
        items.push([
          '{blue-fg}' + name + '{/blue-fg}',
          '{green-fg}' + account.address + '{/green-fg}'
        ]);
      });
      tabs.recipients._.list.setData(items);

      // Debug
      if (termcoin.config.debug) {
        var wallets = '';
        termcoin.bitcoin.coin.accounts.forEach(function(account) {
          var unspent = Object.keys(account.tx._unspent).length;
          var orphans = Object.keys(account.tx._orphans).length;
          var all = Object.keys(account.tx._all).length;
          var spent = all - unspent - orphans;
          wallets += account.getAddress() + '\n';
          wallets += 'Unspent: ' + unspent + '\n';
          wallets += 'Orphans: ' + orphans + '\n';
          Object.keys(account.tx._orphans).forEach(function(key) {
            if (!account.tx._orphans[key]) return;
            if (!account.tx._orphans[key].length) return;
            var orphan = account.tx._orphans[key][0];
            var parts = key.split('/');
            var id = coined.utils.revHex(parts[0]) + '/' + parts[1];
            orphan.tx.inputs.forEach(function(input) {
              var ihash = input.out.hash;
              wallets += '  ' + id + ': '
                + coined.utils.revHex(ihash)
                + '\n';
              if (account.tx._all[ihash]) {
                wallets += '  ' + ' ^ HAS ^\n';
                //var tx = account.tx._all[ihash];
                //delete account.tx._all[ihash];
                //account.tx.add(tx, true);
              }
            });
          });
          wallets += 'All: ' + all + '\n';
          wallets += 'Spent: ' + spent + '\n';
          wallets += '\n';
        });
        tabs.debug._.data.setContent(
          wallets
          + '\n\n' +
          utils.inspect(stats)
        );
      }

      screen.render();

      if (showLoad) screen._.loader.stop();

      return checkEncrypt(function(err) {
        if (err) screen._.msg.error(err.message);
        return done();
      });
    });
  }

  screen.key('f5', function() {
    return refresh(null, true);
  });

  (function callee() {
    return refresh(function() {
      return setTimeout(callee, 10 * 1000);
    });
  })();

  screen.on('element keypress', function(el, ch, key) {
    var _ = screen._;

    if (ch !== 'q') return;

    if (screen.grabKeys) return;

    if (el === _.question
        || el === _.prompt
        || el === _.msg
        || el === _.details
        || el === _.qrbox
        || el === _.fm
        || el === _.picker) {
      return;
    }

    var explore = screen._.tabs.explore
      , data = explore._.data
      , block = (explore._.block || {})._hash
      , last = (blockchain.lastBlock || {})._hash;

    if (el === data && (explore._.tx || explore._.addr || block !== last)) {
      return;
    }

    if (_.msg.visible) {
      _.msg.hide();
      screen.render();
      return;
    }

    return exit();
  });

  // C-c can be used even if keys are locked,
  // for example, during a loading window.
  screen.ignoreLocked.push('C-c');

  screen.key('C-c', function(ch, key) {
    return exit();
  });

  function exit() {
    screen._.msg.hide = function() {};
    screen._.msg.display('Shutting down...', -1);

    if (bitcoin.startServer.started) {
      return bitcoin.stopServer(function() {
        return callback();
      });
    }

    return callback();
  }

  screen.render();
};

/**
 * UI Helpers
 */

ui.copy = function(text, callback) {
  var callback = callback || function() {};

  function exec(args) {
    var file = args.shift();
    var ps = cp.spawn(file, args, {
      stdio: ['pipe', 'ignore', 'ignore']
    });
    ps.stdin.on('error', callback);
    ps.on('error', callback);
    ps.on('exit', function(code) {
      return callback(code !== 0 ? new Error('Exit code: ' + code) : null);
    });
    ps.stdin.end(text + '');
  }

  if (opt.remote) return callback();

  // X11:
  return exec(['xsel', '-i', '-p'], function(err) {
    if (!err) return callback(null);
    return exec(['xclip', '-i', '-selection', 'primary'], function(err) {
      if (!err) return callback(null);
      // Mac:
      return exec(['pbcopy'], function(err) {
        if (!err) return callback(null);
        return callback(new Error('Failed to set clipboard contents.'));
      });
    });
  });
};

// `tail -f` a file.
ui.tailf = function(file) {
  var self = this
    , StringDecoder = require('string_decoder').StringDecoder
    , decode = new StringDecoder('utf8')
    , buffer = new Buffer(64 * 1024)
    , Stream = require('stream').Stream
    , s = new Stream
    , buff = ''
    , pos = 0;

  s.readable = true;
  s.destroy = function() {
    s.destroyed = true;
    s.emit('end');
    s.emit('close');
  };

  fs.open(file, 'a+', 0644, function(err, fd) {
    if (err) {
      s.emit('error', err);
      s.destroy();
      return;
    }

    (function read() {
      if (s.destroyed) {
        fs.close(fd);
        return;
      }

      return fs.read(fd, buffer, 0, buffer.length, pos, function(err, bytes) {
        if (err) {
          s.emit('error', err);
          s.destroy();
          return;
        }

        if (!bytes) {
          if (buff) {
            stream.emit('line', buff);
            buff = '';
          }
          return setTimeout(read, 1000);
        }

        var data = decode.write(buffer.slice(0, bytes));

        s.emit('data', data);

        var data = (buff + data).split(/\n+/)
          , l = data.length - 1
          , i = 0;

        for (; i < l; i++) {
          s.emit('line', data[i]);
        }

        buff = data[l];

        pos += bytes;

        return read();
      });
    })();
  });

  return s;
};

function tailBox(file, box) {
  var stream = ui.tailf(file)
    , rendering;

  var lines = [];

  stream.on('line', function(line) {
    box.pushLine(line);
    if (box._clines.fake.length > 200) {
      //box.setContent('');
      box.shiftLine(100);
    }
    if (rendering) return;
    rendering = true;
    setImmediate(function() {
      rendering = false;
      //box.setScroll(box.getScrollHeight());
      box.setScroll(box._clines.length);
      box.screen.render();
    });
  });

  return stream.destroy.bind(stream);
}

function scanQR(callback) {
  var cmd = ''
    + ' zbarcam -q --raw 2> /dev/null ||'
    + ' LD_PRELOAD=/usr/lib/libv4l/v4l1compat.so'
    + ' zbarcam -q --raw /dev/video0';

  cp.exec(cmd, function(err, stdout, stderr) {
    if (stderr && stderr.trim()) {
      err = new Error(stderr);
    }
    if (err) return callback(err);
    var data = (stdout || '').trim().split('\n')[0];
    return callback(null, stdout);
  });
}

/**
 * Main
 */

ui.main = function(callback) {
  return bitcoin.startServer(function(err) {
    if (err) return callback(err);
    return bitcoin.getStats(function(err, stats) {
      if (err) return callback(err);
      return ui.start(stats, function(err) {
        if (err) return callback(err);
        return callback();
      });
    });
  });
};
