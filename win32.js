'use strict'

const common = require('./common')
const fs = require('fs-extra')
const path = require('path')
const series = require('run-series')

module.exports = {
  createApp: function createApp (opts, templatePath, callback) {
    common.initializeApp(opts, templatePath, path.join('resources', 'app'), function buildWinApp (err, tempPath) {
      if (err) return callback(err)

      var newExePath = path.join(tempPath, `${opts.name}.exe`)
      var operations = [
        function (cb) {
          fs.move(path.join(tempPath, 'electron.exe'), newExePath, cb)
        }
      ]

      var rcOpts = {'version-string': opts['version-string'] || {}}

      if (opts['build-version']) {
        rcOpts['file-version'] = opts['build-version']
      }

      if (opts['app-version']) {
        rcOpts['product-version'] = opts['app-version']
      }

      if (opts['app-copyright']) {
        rcOpts['version-string'].LegalCopyright = opts['app-copyright']
      }

      if (opts.icon || opts['version-string'] || opts['app-copyright'] || opts['app-version'] || opts['build-version']) {
        operations.push(function (cb) {
          common.normalizeExt(opts.icon, '.ico', function (err, icon) {
            // Icon might be omitted or only exist in one OS's format, so skip it if normalizeExt reports an error
            if (!err) {
              rcOpts.icon = icon
            }

            require('rcedit')(newExePath, rcOpts, cb)
          })
        })
      }

      series(operations, function (err) {
        if (err) return callback(err)
        common.moveApp(opts, tempPath, callback)
      })
    })
  }
}
