'use strict';
var _ = require('lodash');
var Download = require('download');
var chalk = require('chalk');

/**
 * @mixin
 * @alias actions/fetch
 */
var fetch = module.exports;

/**
 * Download a file to a given destination.
 *
 * @param {String} url
 * @param {String} destination
 * @param {Function} cb
 */

fetch.fetch = function _fetch(url, destination, cb) {
  var log = this.log('... Fetching %s ...', url);
  var download = new Download()
    .get(url, destination)
    .use(function (res) {
      res.on('data', function () {
        log.write('.');
      });
    });

  download.run(function (err) {
    if (err) return cb(err);

    log.ok('Done in ' + destination).write();
    cb();
  });
};

/**
 * Fetch an archive and extract it to a given destination.
 *
 * @param {String} archive
 * @param {String} destination
 * @param {Object} opts
 * @param {Function} cb
 */

fetch.extract = function _extract(archive, destination, opts, cb) {
  if (_.isFunction(opts) && !cb) {
    cb = opts;
    opts = { extract: true };
  }

  opts = _.assign({ extract: true }, opts);

  var log = this.log.write()
    .info('... Fetching %s ...', archive)
    .info(chalk.yellow('This might take a few moments'));

  var download = new Download()
    .get(archive, destination, opts)
    .use(function (res) {
      res.on('data', function () {
        log.write('.');
      });
    });

  download.run(function (err) {
    if (err) return cb(err);

    log.write().ok('Done in ' + destination).write();
    cb();
  });
};

/** @alias fetch.extract */
fetch.tarball = fetch.extract;

/**
 * Export of the `request` node module.
 * @deprecated Require your own version of the request module.
 *             Yeoman will eventually remove it.
 */
fetch.request = require('request');
