'use strict'

const asar = require('asar')
const child = require('child_process')
const debug = require('debug')('electron-packager')
const download = require('electron-download')
const fs = require('fs-extra')
const getPackageInfo = require('get-package-info')
const ignore = require('./ignore')
const minimist = require('minimist')
const os = require('os')
const path = require('path')
const resolve = require('resolve')
const sanitize = require('sanitize-filename')
const semver = require('semver')
const series = require('run-series')

const archs = ['ia32', 'x64', 'armv7l']
const platforms = ['darwin', 'linux', 'mas', 'win32']

function parseCLIArgs (argv) {
  var args = minimist(argv, {
    boolean: [
      'all',
      'deref-symlinks',
      'download.strictSSL',
      'overwrite',
      'prune',
      'quiet'
    ],
    default: {
      'deref-symlinks': true,
      'download.strictSSL': true,
      prune: true
    },
    string: [
      'electron-version',
      'out'
    ]
  })

  args.dir = args._[0]
  args.name = args._[1]

  // Transform hyphenated keys into camelCase
  module.exports.camelCase(args, false)

  var protocolSchemes = [].concat(args.protocol || [])
  var protocolNames = [].concat(args.protocolName || [])

  if (protocolSchemes && protocolNames && protocolNames.length === protocolSchemes.length) {
    args.protocols = protocolSchemes.map(function (scheme, i) {
      return {schemes: [scheme], name: protocolNames[i]}
    })
  }

  if (args.out === '') {
    args.out = null
  }

  // Overrides for multi-typed arguments, because minimist doesn't support it

  // asar: `Object` or `true`
  if (args.asar === 'true' || args.asar instanceof Array) {
    args.asar = true
  }

  // osx-sign: `Object` or `true`
  if (args.osxSign === 'true') {
    args.osxSign = true
  }

  // tmpdir: `String` or `false`
  if (args.tmpdir === 'false') {
    args.tmpdir = false
  }

  return args
}

function asarApp (appPath, asarOptions, cb) {
  var dest = path.join(appPath, '..', 'app.asar')
  debug(`Running asar with the options ${JSON.stringify(asarOptions)}`)
  asar.createPackageWithOptions(appPath, dest, asarOptions, function (err) {
    if (err) return cb(err)
    fs.remove(appPath, function (err) {
      if (err) return cb(err)
      cb(null, dest)
    })
  })
}

function isPlatformMac (platform) {
  return platform === 'darwin' || platform === 'mas'
}

function sanitizeAppName (name) {
  return sanitize(name, {replacement: '-'})
}

function generateFinalBasename (opts) {
  return `${sanitizeAppName(opts.name)}-${opts.platform}-${opts.arch}`
}

function generateFinalPath (opts) {
  return path.join(opts.out || process.cwd(), generateFinalBasename(opts))
}

function info (message, quiet) {
  if (!quiet) {
    console.error(message)
  }
}

function warning (message, quiet) {
  if (!quiet) {
    console.warn(`WARNING: ${message}`)
  }
}

function subOptionWarning (properties, optionName, parameter, value, quiet) {
  if (properties.hasOwnProperty(parameter)) {
    warning(`${optionName}.${parameter} will be inferred from the main options`, quiet)
  }
  properties[parameter] = value
}

function baseTempDir (opts) {
  return path.join(opts.tmpdir || os.tmpdir(), 'electron-packager')
}

function createAsarOpts (opts) {
  let asarOptions
  if (opts.asar === true) {
    asarOptions = {}
  } else if (typeof opts.asar === 'object') {
    asarOptions = opts.asar
  } else if (opts.asar === false || opts.asar === undefined) {
    return false
  } else {
    warning(`asar parameter set to an invalid value (${opts.asar}), ignoring and disabling asar`)
    return false
  }

  return asarOptions
}

function createDownloadOpts (opts, platform, arch) {
  let downloadOpts = Object.assign({}, opts.download)

  subOptionWarning(downloadOpts, 'download', 'platform', platform, opts.quiet)
  subOptionWarning(downloadOpts, 'download', 'arch', arch, opts.quiet)
  subOptionWarning(downloadOpts, 'download', 'version', opts.electronVersion, opts.quiet)

  return downloadOpts
}

function isMissingRequiredProperty (props) {
  var requiredProps = props.filter(
    (prop) => prop === 'productName' || prop === 'dependencies.electron'
  )
  return requiredProps.length !== 0
}

function errorMessageForProperty (prop) {
  let hash, propDescription
  switch (prop) {
    case 'productName':
      hash = 'name'
      propDescription = 'application name'
      break
    case 'dependencies.electron':
      hash = 'version'
      propDescription = 'Electron version'
      break
    default:
      hash = ''
      propDescription = '[Unknown Property]'
  }

  return `Unable to determine ${propDescription}. Please specify an ${propDescription}\n\n` +
    'For more information, please see\n' +
    `https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#${hash}\n`
}

function getVersion (opts, packageName, src, cb) {
  resolve(packageName, {
    basedir: path.dirname(src)
  }, (err, res, pkg) => {
    if (err) return cb(err)
    debug(`Inferring target Electron version from ${packageName} in ${src}`)
    opts.electronVersion = pkg.version
    return cb(null)
  })
}

module.exports = {
  archs: archs,
  platforms: platforms,

  parseCLIArgs: parseCLIArgs,

  isPlatformMac: isPlatformMac,

  subOptionWarning: subOptionWarning,

  baseTempDir: baseTempDir,

  createAsarOpts: createAsarOpts,
  createDownloadOpts: createDownloadOpts,
  createDownloadCombos: function createDownloadCombos (opts, selectedPlatforms, selectedArchs, ignoreFunc) {
    let combinations = []
    for (let arch of selectedArchs) {
      for (let platform of selectedPlatforms) {
        // Electron does not have 32-bit releases for Mac OS X, so skip that combination
        if (isPlatformMac(platform) && arch === 'ia32') continue
        // Electron only has armv7l releases for Linux
        if (arch === 'armv7l' && platform !== 'linux') continue
        if (typeof ignoreFunc === 'function' && ignoreFunc(platform, arch)) continue
        combinations.push(createDownloadOpts(opts, platform, arch))
      }
    }

    return combinations
  },

  deprecatedParameter: function deprecatedParameter (properties, oldName, newName, newCLIName) {
    if (properties.hasOwnProperty(oldName)) {
      warning(`The ${oldName} parameter is deprecated, use ${newName} (or --${newCLIName} in the CLI) instead`)
      if (!properties.hasOwnProperty(newName)) {
        properties[newName] = properties[oldName]
      }
      delete properties[oldName]
    }
  },

  kebabProperties: {
    'electron-version': 'electronVersion',
    'app-copyright': 'appCopyright',
    'app-version': 'appVersion',
    'build-version': 'buildVersion',
    'app-bundle-id': 'appBundleId',
    'app-category-type': 'appCategoryType',
    'extend-info': 'extendInfo',
    'extra-resource': 'extraResource',
    'helper-bundle-id': 'helperBundleId',
    'osx-sign': 'osxSign',
    'protocol-name': 'protocolName'
  },

  camelCase: function camelCase (properties, warn) {
    Object.keys(module.exports.kebabProperties).forEach(function (key) {
      var value = module.exports.kebabProperties[key]
      if (properties.hasOwnProperty(key)) {
        if (warn) {
          warning(`The ${key} parameter is deprecated when used from JS, use ${value} instead. It will be removed in the next major version.`)
        }
        if (!properties.hasOwnProperty(value)) {
          properties[value] = properties[key]
        }
        delete properties[key]
      }
    })
  },

  downloadElectronZip: function downloadElectronZip (downloadOpts, cb) {
    // armv7l builds have only been backfilled for Electron >= 1.0.0.
    // See: https://github.com/electron/electron/pull/6986
    if (downloadOpts.arch === 'armv7l' && semver.lt(downloadOpts.version, '1.0.0')) {
      downloadOpts.arch = 'arm'
    }
    debug(`Downloading Electron with options ${JSON.stringify(downloadOpts)}`)
    download(downloadOpts, cb)
  },

  generateFinalBasename: generateFinalBasename,
  generateFinalPath: generateFinalPath,

  getMetadataFromPackageJSON: function getMetadataFromPackageJSON (opts, dir, cb) {
    let props = []
    if (!opts.name) props.push(['productName', 'name'])
    if (!opts.appVersion) props.push('version')
    if (!opts.electronVersion) {
      props.push([
        'dependencies.electron',
        'devDependencies.electron',
        'dependencies.electron-prebuilt',
        'devDependencies.electron-prebuilt'
      ])
    }

    // Name and version provided, no need to infer
    if (props.length === 0) return cb(null)

    // Search package.json files to infer name and version from
    getPackageInfo(props, dir, (err, result) => {
      if (err && err.missingProps) {
        let missingProps = err.missingProps.map(prop => {
          return Array.isArray(prop) ? prop[0] : prop
        })

        if (isMissingRequiredProperty(missingProps)) {
          let messages = missingProps.map(errorMessageForProperty)

          debug(err.message)
          err.message = messages.join('\n') + '\n'
          return cb(err)
        } else {
          // Missing props not required, can continue w/ partial result
          result = err.result
        }
      } else if (err) {
        return cb(err)
      }

      if (result.values.productName) {
        debug(`Inferring application name from ${result.source.productName.prop} in ${result.source.productName.src}`)
        opts.name = result.values.productName
      }

      if (result.values.version) {
        debug(`Inferring appVersion from version in ${result.source.version.src}`)
        opts.appVersion = result.values.version
      }

      if (result.values['dependencies.electron']) {
        let prop = result.source['dependencies.electron'].prop.split('.')[1]
        let src = result.source['dependencies.electron'].src
        return getVersion(opts, prop, src, cb)
      } else {
        return cb(null)
      }
    })
  },

  info: info,

  initializeApp: function initializeApp (opts, templatePath, appRelativePath, callback) {
    // Performs the following initial operations for an app:
    // * Creates temporary directory
    // * Copies template into temporary directory
    // * Copies user's app into temporary directory
    // * Prunes non-production node_modules (if opts.prune is either truthy or undefined)
    // * Creates an asar (if opts.asar is set)

    var tempPath
    if (opts.tmpdir === false) {
      tempPath = generateFinalPath(opts)
    } else {
      tempPath = path.join(baseTempDir(opts), `${opts.platform}-${opts.arch}`, generateFinalBasename(opts))
    }

    debug(`Initializing app in ${tempPath} from ${templatePath} template`)

    // Path to `app` directory
    var appPath = path.join(tempPath, appRelativePath)
    var resourcesPath = path.resolve(appPath, '..')

    var operations = [
      function (cb) {
        fs.move(templatePath, tempPath, {clobber: true}, cb)
      },
      function (cb) {
        // `deref-symlinks` is the default value so we'll use it unless
        // `derefSymlinks` is defined.
        var shouldDeref = opts['deref-symlinks']
        if (opts.derefSymlinks !== undefined) {
          shouldDeref = opts.derefSymlinks
        }

        fs.copy(opts.dir, appPath, {filter: ignore.userIgnoreFilter(opts), dereference: shouldDeref}, cb)
      },
      function (cb) {
        var afterCopyHooks = (opts.afterCopy || []).map(function (afterCopyFn) {
          return function (cb) {
            afterCopyFn(appPath, opts.electronVersion, opts.platform, opts.arch, cb)
          }
        })
        series(afterCopyHooks, cb)
      },
      function (cb) {
        // Support removing old default_app folder that is now an asar archive
        fs.remove(path.join(resourcesPath, 'default_app'), cb)
      },
      function (cb) {
        fs.remove(path.join(resourcesPath, 'default_app.asar'), cb)
      }
    ]

    // Prune and asar are now performed before platform-specific logic, primarily so that
    // appPath is predictable (e.g. before .app is renamed for mac)
    if (opts.prune || opts.prune === undefined) {
      operations.push(function (cb) {
        debug('Running npm prune --production')
        child.exec('npm prune --production', {cwd: appPath}, cb)
      })
    }

    let asarOptions = createAsarOpts(opts)
    if (asarOptions) {
      operations.push(function (cb) {
        asarApp(appPath, asarOptions, cb)
      })
    }

    series(operations, function (err) {
      if (err) return callback(err)
      // Resolve to path to temporary app folder for platform-specific processes to use
      callback(null, tempPath)
    })
  },

  moveApp: function finalizeApp (opts, tempPath, callback) {
    var finalPath = generateFinalPath(opts)

    if (opts.tmpdir === false) {
      callback(null, finalPath)
      return
    }

    debug(`Moving ${tempPath} to ${finalPath}`)
    fs.move(tempPath, finalPath, function (err) {
      callback(err, finalPath)
    })
  },

  normalizeExt: function normalizeExt (filename, targetExt, cb) {
    // Forces a filename to a given extension and fires the given callback with the normalized filename,
    // if it exists.  Otherwise reports the error from the fs.stat call.
    // (Used for resolving icon filenames, particularly during --all runs.)

    // This error path is used by win32.js if no icon is specified
    if (!filename) return cb(new Error('No filename specified to normalizeExt'))

    var ext = path.extname(filename)
    if (ext !== targetExt) {
      filename = filename.slice(0, filename.length - ext.length) + targetExt
    }

    fs.stat(filename, function (err) {
      cb(err, err ? null : filename)
    })
  },

  rename: function rename (basePath, oldName, newName, cb) {
    debug(`Renaming ${oldName} to ${newName} in ${basePath}`)
    fs.rename(path.join(basePath, oldName), path.join(basePath, newName), cb)
  },
  sanitizeAppName: sanitizeAppName,
  warning: warning
}
