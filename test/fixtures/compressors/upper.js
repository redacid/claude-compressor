'use strict';

module.exports = {
  name: 'upper',
  isAvailable: () => true,
  matches: (cmd) => cmd.startsWith('echo '),
  rewrite: (cmd) => cmd.toUpperCase(),
};
