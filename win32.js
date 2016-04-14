var common = require('./common')
var fs = require('fs-extra')
var path = require('path')
var series = require('run-series')

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

      if (opts.icon || opts['version-string']) {
        operations.push(function (cb) {
          common.normalizeExt(opts.icon, '.ico', function (err, icon) {
            var rcOpts = {}
            if (opts['version-string']) {
              rcOpts['version-string'] = opts['version-string']

              if (opts['build-version']) {
                rcOpts['file-version'] = opts['build-version']
              } else if (opts['version-string'].FileVersion) {
                rcOpts['file-version'] = opts['version-string'].FileVersion
              }

              if (opts['app-version']) {
                rcOpts['product-version'] = opts['app-version']
              } else if (opts['version-string'].ProductVersion) {
                rcOpts['product-version'] = opts['version-string'].ProductVersion
              }

              if (opts['app-copyright']) {
                rcOpts['version-string'].LegalCopyright = opts['app-copyright']
              }
            }

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
