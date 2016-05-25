'use strict'

const common = require('./common')
const fs = require('fs-extra')
const path = require('path')
const plist = require('plist')
const series = require('run-series')
const sign = require('electron-osx-sign')

function rename (basePath, oldName, newName, cb) {
  fs.move(path.join(basePath, oldName), path.join(basePath, newName), cb)
}

function moveHelpers (frameworksPath, appName, callback) {
  series([' Helper', ' Helper EH', ' Helper NP'].map(function (suffix) {
    return function (cb) {
      var executableBasePath = path.join(frameworksPath, `Electron${suffix}.app`, 'Contents', 'MacOS')

      rename(executableBasePath, `Electron${suffix}`, appName + suffix, function (err) {
        if (err) return cb(err)
        rename(frameworksPath, `Electron${suffix}.app`, `${appName}${suffix}.app`, cb)
      })
    }
  }), function (err) {
    callback(err)
  })
}

function filterCFBundleIdentifier (identifier) {
  // Remove special characters and allow only alphanumeric (A-Z,a-z,0-9), hyphen (-), and period (.)
  // Apple documentation: https://developer.apple.com/library/mac/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html#//apple_ref/doc/uid/20001431-102070
  return identifier.replace(/ /g, '-').replace(/[^a-zA-Z0-9.-]/g, '')
}

function createSignOpts (properties, platform, app) {
  // use default sign opts if osx-sign is true, otherwise clone osx-sign object
  var signOpts = properties === true ? {identity: null} : Object.assign({}, properties)

  // osx-sign options are handed off to sign module, but
  // with a few additions from the main options
  // user may think they can pass platform or app, but they will be ignored
  common.subOptionWarning(signOpts, 'osx-sign', 'platform', platform)
  common.subOptionWarning(signOpts, 'osx-sign', 'app', app)

  if (signOpts.binaries) {
    console.warn('WARNING: osx-sign.binaries signing will fail. Sign manually, or with electron-osx-sign.')
  }

  // Take argument osx-sign as signing identity:
  // if opts['osx-sign'] is true (bool), fallback to identity=null for
  // autodiscovery. Otherwise, provide signing certificate info.
  if (signOpts.identity === true) {
    signOpts.identity = null
  }

  return signOpts
}

module.exports = {
  createApp: function createApp (opts, templatePath, callback) {
    var appRelativePath = path.join('Electron.app', 'Contents', 'Resources', 'app')
    common.initializeApp(opts, templatePath, appRelativePath, function buildMacApp (err, tempPath) {
      if (err) return callback(err)

      var contentsPath = path.join(tempPath, 'Electron.app', 'Contents')
      var frameworksPath = path.join(contentsPath, 'Frameworks')
      var appPlistFilename = path.join(contentsPath, 'Info.plist')
      var helperPlistFilename = path.join(frameworksPath, 'Electron Helper.app', 'Contents', 'Info.plist')
      var helperEHPlistFilename = path.join(frameworksPath, 'Electron Helper EH.app', 'Contents', 'Info.plist')
      var helperNPPlistFilename = path.join(frameworksPath, 'Electron Helper NP.app', 'Contents', 'Info.plist')
      var appPlist = plist.parse(fs.readFileSync(appPlistFilename).toString())
      var helperPlist = plist.parse(fs.readFileSync(helperPlistFilename).toString())
      var helperEHPlist = plist.parse(fs.readFileSync(helperEHPlistFilename).toString())
      var helperNPPlist = plist.parse(fs.readFileSync(helperNPPlistFilename).toString())

      // Update plist files

      // If an extend-info file was supplied, copy its contents in first

      if (opts['extend-info']) {
        var extendAppPlist = plist.parse(fs.readFileSync(opts['extend-info']).toString())
        for (var key in extendAppPlist) {
          appPlist[key] = extendAppPlist[key]
        }
      }

      // Now set fields based on explicit options

      var defaultBundleName = 'com.electron.' + opts.name.toLowerCase()
      var appBundleIdentifier = filterCFBundleIdentifier(opts['app-bundle-id'] || defaultBundleName)
      var helperBundleIdentifier = filterCFBundleIdentifier(opts['helper-bundle-id'] || appBundleIdentifier + '.helper')

      var appVersion = opts['app-version']
      var buildVersion = opts['build-version']
      var appCategoryType = opts['app-category-type']
      var humanReadableCopyright = opts['app-copyright']

      appPlist.CFBundleDisplayName = opts.name
      appPlist.CFBundleIdentifier = appBundleIdentifier
      appPlist.CFBundleName = opts.name
      helperPlist.CFBundleDisplayName = opts.name + ' Helper'
      helperPlist.CFBundleIdentifier = helperBundleIdentifier
      appPlist.CFBundleExecutable = opts.name
      helperPlist.CFBundleName = opts.name
      helperPlist.CFBundleExecutable = opts.name + ' Helper'
      helperEHPlist.CFBundleDisplayName = opts.name + ' Helper EH'
      helperEHPlist.CFBundleIdentifier = helperBundleIdentifier + '.EH'
      helperEHPlist.CFBundleName = opts.name + ' Helper EH'
      helperEHPlist.CFBundleExecutable = opts.name + ' Helper EH'
      helperNPPlist.CFBundleDisplayName = opts.name + ' Helper NP'
      helperNPPlist.CFBundleIdentifier = helperBundleIdentifier + '.NP'
      helperNPPlist.CFBundleName = opts.name + ' Helper NP'
      helperNPPlist.CFBundleExecutable = opts.name + ' Helper NP'

      if (appVersion) {
        appPlist.CFBundleShortVersionString = appPlist.CFBundleVersion = '' + appVersion
      }

      if (buildVersion) {
        appPlist.CFBundleVersion = '' + buildVersion
      }

      if (opts.protocols && opts.protocols.length) {
        appPlist.CFBundleURLTypes = opts.protocols.map(function (protocol) {
          return {
            CFBundleURLName: protocol.name,
            CFBundleURLSchemes: [].concat(protocol.schemes)
          }
        })
      }

      if (appCategoryType) {
        appPlist.LSApplicationCategoryType = appCategoryType
      }

      if (humanReadableCopyright) {
        appPlist.NSHumanReadableCopyright = humanReadableCopyright
      }

      fs.writeFileSync(appPlistFilename, plist.build(appPlist))
      fs.writeFileSync(helperPlistFilename, plist.build(helperPlist))
      fs.writeFileSync(helperEHPlistFilename, plist.build(helperEHPlist))
      fs.writeFileSync(helperNPPlistFilename, plist.build(helperNPPlist))

      var operations = []

      // Copy in the icon, if supplied
      if (opts.icon) {
        operations.push(function (cb) {
          common.normalizeExt(opts.icon, '.icns', function (err, icon) {
            if (err) {
              // Ignore error if icon doesn't exist, in case it's only available for other OS
              cb(null)
            } else {
              fs.copy(icon, path.join(contentsPath, 'Resources', appPlist.CFBundleIconFile), cb)
            }
          })
        })
      }

      // Copy in any other extras
      var extras = opts['extra-resource']
      if (extras) {
        if (!Array.isArray(extras)) extras = [extras]
        extras.forEach(function (val) {
          operations.push(function (cb) {
            fs.copy(val, path.join(contentsPath, 'Resources', path.basename(val)), cb)
          })
        })
      }

      // Rename the Contents/MacOS/Electron binary
      operations.push(function (cb) {
        rename(path.join(contentsPath, 'MacOS'), 'Electron', appPlist.CFBundleExecutable, cb)
      })

      // Move Helper apps/executables, then top-level .app
      var finalAppPath = path.join(tempPath, `${opts.name}.app`)
      operations.push(function (cb) {
        moveHelpers(frameworksPath, opts.name, cb)
      }, function (cb) {
        fs.move(path.dirname(contentsPath), finalAppPath, cb)
      })

      if ((opts.platform === 'all' || opts.platform === 'mas') && opts['osx-sign'] === undefined) {
        console.warn('WARNING: signing is required for mas builds. Provide the osx-sign option, or manually sign the app later.')
      }

      if (opts['osx-sign']) {
        operations.push(function (cb) {
          sign(createSignOpts(opts['osx-sign'], opts.platform, finalAppPath), function (err) {
            if (err) {
              // Although not signed successfully, the application is packed.
              console.warn('Code sign failed; please retry manually.', err)
            }
            cb()
          })
        })
      }

      series(operations, function (err) {
        if (err) return callback(err)
        common.moveApp(opts, tempPath, callback)
      })
    })
  },
  createSignOpts: createSignOpts,
  filterCFBundleIdentifier: filterCFBundleIdentifier
}
