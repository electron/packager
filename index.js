'use strict'

const common = require('./common')
const debug = require('debug')('electron-packager')
const download = require('electron-download')
const extract = require('extract-zip')
const fs = require('fs-extra')
const getPackageInfo = require('get-package-info')
const metadata = require('./package.json')
const os = require('os')
const path = require('path')
const resolve = require('resolve')
const series = require('run-series')

var supportedArchs = common.archs.reduce(function (result, arch) {
  result[arch] = 1
  return result
}, {})

var supportedPlatforms = {
  // Maps to module ID for each platform (lazy-required if used)
  darwin: './mac',
  linux: './linux',
  mas: './mac', // map to darwin
  win32: './win32'
}

function debugHostInfo () {
  debug(`Electron Packager ${metadata.version}`)
  debug(`Node ${process.version}`)
  debug(`Host Operating system: ${process.platform} (${process.arch})`)
}

function validateList (list, supported, name) {
  // Validates list of architectures or platforms.
  // Returns a normalized array if successful, or an error message string otherwise.

  if (!list) return `Must specify ${name}`
  if (list === 'all') return Object.keys(supported)

  if (!Array.isArray(list)) list = list.split(',')
  for (var i = list.length; i--;) {
    if (!supported[list[i]]) {
      return `Unsupported ${name} ${list[i]}; must be one of: ${Object.keys(supported).join(', ')}`
    }
  }

  return list
}

function getMetadata (opts, dir, cb) {
  var props = []
  if (!opts.name) props.push(['productName', 'name'])
  if (!opts['app-version']) props.push('version')
  if (!opts.version) props.push(['dependencies.electron', 'devDependencies.electron'])

  // Name and version provided, no need to infer
  if (props.length === 0) return cb(null)

  // Search package.json files to infer name and version from
  getPackageInfo(props, dir, function (err, result) {
    if (err) {
      // `get-package-info` exploded looking for `electron`. Try `electron-prebuilt` instead
      props.pop()
      props.push(['dependencies.electron-prebuilt', 'devDependencies.electron-prebuilt'])
      getPackageInfo(props, dir, function (err, result) {
        if (err) return cb(err)
        return inferNameAndVersionFromInstalled('electron-prebuilt', opts, result, cb)
      })
    } else {
      return inferNameAndVersionFromInstalled('electron', opts, result, cb)
    }
  })
}

function inferNameAndVersionFromInstalled (packageName, opts, result, cb) {
  if (result.values.productName) {
    debug('Inferring application name from productName or name in package.json')
    opts.name = result.values.productName
  }

  if (result.values.version) {
    debug('Inferring app-version from version in package.json')
    opts['app-version'] = result.values.version
  }

  if (result.values[`dependencies.${packageName}`]) {
    resolve(packageName, {
      basedir: path.dirname(result.source[`dependencies.${packageName}`].src)
    }, function (err, res, pkg) {
      if (err) return cb(err)
      debug(`Inferring target Electron version from ${packageName} dependency or devDependency in package.json`)
      opts.version = pkg.version
      return cb(null)
    })
  } else {
    return cb(null)
  }
}

function createSeries (opts, archs, platforms) {
  var tempBase = path.join(opts.tmpdir || os.tmpdir(), 'electron-packager')

  function testSymlink (cb) {
    var testPath = path.join(tempBase, 'symlink-test')
    var testFile = path.join(testPath, 'test')
    var testLink = path.join(testPath, 'testlink')
    series([
      function (cb) {
        fs.outputFile(testFile, '', cb)
      },
      function (cb) {
        fs.symlink(testFile, testLink, cb)
      }
    ], function (err) {
      var result = !err
      fs.remove(testPath, function () {
        cb(result) // ignore errors on cleanup
      })
    })
  }

  var combinations = []
  archs.forEach(function (arch) {
    platforms.forEach(function (platform) {
      // Electron does not have 32-bit releases for Mac OS X, so skip that combination
      if (common.isPlatformMac(platform) && arch === 'ia32') return
      combinations.push(common.createDownloadOpts(opts, platform, arch))
    })
  })

  var tasks = []
  var useTempDir = opts.tmpdir !== false
  if (useTempDir) {
    tasks.push(function (cb) {
      fs.remove(tempBase, cb)
    })
  }
  return tasks.concat(combinations.map(function (combination) {
    var arch = combination.arch
    var platform = combination.platform
    var version = combination.version

    return function (callback) {
      download(combination, function (err, zipPath) {
        if (err) return callback(err)

        function createApp (comboOpts) {
          var buildParentDir
          if (useTempDir) {
            buildParentDir = tempBase
          } else {
            buildParentDir = opts.out || process.cwd()
          }
          var buildDir = path.join(buildParentDir, `${platform}-${arch}-template`)
          console.error(`Packaging app for platform ${platform} ${arch} using electron v${version}`)
          series([
            function (cb) {
              fs.mkdirs(buildDir, cb)
            },
            function (cb) {
              extract(zipPath, {dir: buildDir}, cb)
            },
            function (cb) {
              if (!opts.afterExtract || !Array.isArray(opts.afterExtract)) {
                cb()
              } else {
                var newFunctions = opts.afterExtract.map(function (fn) {
                  return fn.bind(this, buildDir, version, platform, arch)
                })
                series(newFunctions, cb)
              }
            }
          ], function () {
            require(supportedPlatforms[platform]).createApp(comboOpts, buildDir, callback)
          })
        }

        // Create delegated options object with specific platform and arch, for output directory naming
        var comboOpts = Object.create(opts)
        comboOpts.arch = arch
        comboOpts.platform = platform
        comboOpts.version = version
        comboOpts.afterCopy = opts.afterCopy

        if (!useTempDir) {
          createApp(comboOpts)
          return
        }

        function checkOverwrite () {
          var finalPath = common.generateFinalPath(comboOpts)
          fs.exists(finalPath, function (exists) {
            if (exists) {
              if (opts.overwrite) {
                fs.remove(finalPath, function () {
                  createApp(comboOpts)
                })
              } else {
                console.error(`Skipping ${platform} ${arch} (output dir already exists, use --overwrite to force)`)
                callback()
              }
            } else {
              createApp(comboOpts)
            }
          })
        }

        if (common.isPlatformMac(combination.platform)) {
          testSymlink(function (result) {
            if (result) return checkOverwrite()

            console.error(`Cannot create symlinks; skipping ${combination.platform} platform`)
            callback()
          })
        } else {
          checkOverwrite()
        }
      })
    }
  }))
}

module.exports = function packager (opts, cb) {
  debugHostInfo()
  var archs = validateList(opts.all ? 'all' : opts.arch, supportedArchs, 'arch')
  var platforms = validateList(opts.all ? 'all' : opts.platform, supportedPlatforms, 'platform')
  if (!Array.isArray(archs)) return cb(new Error(archs))
  if (!Array.isArray(platforms)) return cb(new Error(platforms))
  debug(`Target Platforms: ${platforms.join(', ')}`)
  debug(`Target Architectures: ${archs.join(', ')}`)

  getMetadata(opts, path.resolve(process.cwd(), opts.dir) || process.cwd(), function (err) {
    if (err) {
      err.message = 'Unable to determine application name or Electron version. ' +
        'Please specify an application name and Electron version.\n\n' +
        'For more infomation, please see \n' +
        'https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#name or \n' +
        'https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#version\n\n' +
        err.message
      return cb(err)
    }

    debug(`Application name: ${opts.name}`)
    debug(`Target Electron version: ${opts.version}`)

    // Ignore this and related modules by default
    var defaultIgnores = [
      '/node_modules/electron($|/)',
      '/node_modules/electron-prebuilt($|/)',
      '/node_modules/electron-packager($|/)',
      '/\\.git($|/)',
      '/node_modules/\\.bin($|/)'
    ]

    if (typeof (opts.ignore) !== 'function') {
      if (opts.ignore && !Array.isArray(opts.ignore)) opts.ignore = [opts.ignore]
      opts.ignore = (opts.ignore) ? opts.ignore.concat(defaultIgnores) : defaultIgnores

      debug(`Ignored path regular expressions:\n${opts.ignore.map(function (ignore) { return `* ${ignore}` }).join('\n')}`)
    }

    series(createSeries(opts, archs, platforms), function (err, appPaths) {
      if (err) return cb(err)

      cb(null, appPaths.filter(function (appPath) {
        // Remove falsy entries (e.g. skipped platforms)
        return appPath
      }))
    })
  })
}
