'use strict'

const asar = require('asar')
const child = require('child_process')
const debug = require('debug')('electron-packager')
const fs = require('fs-extra')
const minimist = require('minimist')
const os = require('os')
const path = require('path')
const series = require('run-series')

const archs = ['ia32', 'x64']
const platforms = ['darwin', 'linux', 'mas', 'win32']

function parseCLIArgs (argv) {
  var args = minimist(argv, {
    boolean: [
      'all',
      'deref-symlinks',
      'download.strictSSL',
      'overwrite',
      'prune',
      'strict-ssl'
    ],
    default: {
      'deref-symlinks': true,
      'download.strictSSL': true,
      'strict-ssl': true
    },
    string: [
      'out'
    ]
  })

  args.dir = args._[0]
  args.name = args._[1]

  var protocolSchemes = [].concat(args.protocol || [])
  var protocolNames = [].concat(args['protocol-name'] || [])

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
  if (args['osx-sign'] === 'true') {
    args['osx-sign'] = true
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

function generateFinalBasename (opts) {
  return `${opts.name}-${opts.platform}-${opts.arch}`
}

function generateFinalPath (opts) {
  return path.join(opts.out || process.cwd(), generateFinalBasename(opts))
}

function subOptionWarning (properties, optionName, parameter, value) {
  if (properties.hasOwnProperty(parameter)) {
    console.warn(`WARNING: ${optionName}.${parameter} will be inferred from the main options`)
  }
  properties[parameter] = value
}

function deprecatedParameter (properties, oldName, newName, extraCondition/* optional */) {
  if (extraCondition === undefined) {
    extraCondition = true
  }
  if (properties.hasOwnProperty(oldName) && extraCondition) {
    console.warn(`The ${oldName} parameter is deprecated, use ${newName} instead`)
  }
}

function userIgnoreFilter (opts) {
  var ignore = opts.ignore || []
  var ignoreFunc = null

  if (typeof (ignore) === 'function') {
    ignoreFunc = function (file) { return !ignore(file) }
  } else {
    if (!Array.isArray(ignore)) ignore = [ignore]

    ignoreFunc = function filterByRegexes (file) {
      for (var i = 0; i < ignore.length; i++) {
        if (file.match(ignore[i])) {
          return false
        }
      }

      return true
    }
  }

  var normalizedOut = opts.out ? path.resolve(opts.out) : null
  var outIgnores = []
  if (normalizedOut === null || normalizedOut === process.cwd()) {
    platforms.forEach(function (platform) {
      archs.forEach(function (arch) {
        outIgnores.push(path.join(process.cwd(), `${opts.name}-${platform}-${arch}`))
      })
    })
  } else {
    outIgnores.push(normalizedOut)
  }

  return function filter (file) {
    if (outIgnores.indexOf(file) !== -1) {
      return false
    }

    var name = file.split(path.resolve(opts.dir))[1]

    if (path.sep === '\\') {
      // convert slashes so unix-format ignores work
      name = name.replace(/\\/g, '/')
    }

    return ignoreFunc(name)
  }
}

function createAsarOpts (opts) {
  deprecatedParameter(opts, 'asar-unpack', 'asar.unpack')
  deprecatedParameter(opts, 'asar-unpack-dir', 'asar.unpackDir')

  let asarOptions
  if (opts.asar === true) {
    asarOptions = {}
  } else if (typeof opts.asar === 'object') {
    asarOptions = opts.asar
  } else if (opts.asar === false || opts.asar === undefined) {
    return false
  } else {
    console.warn(`asar parameter set to an invalid value (${opts.asar}), ignoring and disabling asar`)
    return false
  }

  return Object.assign({
    unpack: opts['asar-unpack'],
    unpackDir: opts['asar-unpack-dir']
  }, asarOptions)
}

module.exports = {
  archs: archs,
  platforms: platforms,

  parseCLIArgs: parseCLIArgs,

  isPlatformMac: function isPlatformMac (platform) {
    return platform === 'darwin' || platform === 'mas'
  },

  subOptionWarning: subOptionWarning,

  createAsarOpts: createAsarOpts,

  createDownloadOpts: function createDownloadOpts (opts, platform, arch) {
    deprecatedParameter(opts, 'cache', 'download.cache')
    deprecatedParameter(opts, 'strict-ssl', 'download.strictSSL', opts['strict-ssl'] === false)

    var downloadOpts = Object.assign({
      cache: opts.cache,
      strictSSL: opts['strict-ssl']
    }, opts.download)

    subOptionWarning(downloadOpts, 'download', 'platform', platform)
    subOptionWarning(downloadOpts, 'download', 'arch', arch)
    subOptionWarning(downloadOpts, 'download', 'version', opts.version)

    return downloadOpts
  },

  generateFinalBasename: generateFinalBasename,
  generateFinalPath: generateFinalPath,

  initializeApp: function initializeApp (opts, templatePath, appRelativePath, callback) {
    // Performs the following initial operations for an app:
    // * Creates temporary directory
    // * Copies template into temporary directory
    // * Copies user's app into temporary directory
    // * Prunes non-production node_modules (if opts.prune is set)
    // * Creates an asar (if opts.asar is set)

    var tempPath
    if (opts.tmpdir === false) {
      tempPath = generateFinalPath(opts)
    } else {
      tempPath = path.join(opts.tmpdir || os.tmpdir(), 'electron-packager', `${opts.platform}-${opts.arch}`, generateFinalBasename(opts))
    }

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

        fs.copy(opts.dir, appPath, {filter: userIgnoreFilter(opts), dereference: shouldDeref}, cb)
      },
      function (cb) {
        var afterCopyHooks = (opts.afterCopy || []).map(function (afterCopyFn) {
          return function (cb) {
            afterCopyFn(appPath, opts.version, opts.platform, opts.arch, cb)
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
    if (opts.prune) {
      operations.push(function (cb) {
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
    fs.rename(path.join(basePath, oldName), path.join(basePath, newName), cb)
  }
}
