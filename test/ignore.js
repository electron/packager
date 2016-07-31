'use strict'

const common = require('../common')
const config = require('./config.json')
const fs = require('fs-extra')
const path = require('path')
const packager = require('..')
const series = require('run-series')
const util = require('./util')
const waterfall = require('run-waterfall')

function createIgnoreTest (opts, ignorePattern, ignoredFile) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = util.fixtureSubdir('basic')
    opts.ignore = ignorePattern

    var appPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        appPath = path.join(paths[0], util.generateResourcesPath(opts), 'app')
        fs.stat(path.join(appPath, 'package.json'), cb)
      }, function (stats, cb) {
        t.true(stats.isFile(), 'The expected output directory should exist and contain files')
        fs.exists(path.join(appPath, ignoredFile), function (exists) {
          t.false(exists, 'Ignored file should not exist in output app directory')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createIgnoreOutDirTest (opts, distPath) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'

    var appDir = util.getWorkCwd()
    opts.dir = appDir
    // we don't use path.join here to avoid normalizing
    var outDir = opts.dir + path.sep + distPath
    opts.out = outDir

    series([
      function (cb) {
        fs.copy(util.fixtureSubdir('basic'), appDir, {dereference: true, stopOnErr: true, filter: function (file) {
          return path.basename(file) !== 'node_modules'
        }}, cb)
      },
      function (cb) {
        // create out dir before packager (real world issue - when second run includes uningnored out dir)
        fs.mkdirp(outDir, cb)
      },
      function (cb) {
        // create file to ensure that directory will be not ignored because empty
        fs.open(path.join(outDir, 'ignoreMe'), 'w', function (err, fd) {
          if (err) return cb(err)
          fs.close(fd, cb)
        })
      },
      function (cb) {
        packager(opts, cb)
      },
      function (cb) {
        fs.exists(path.join(outDir, common.generateFinalBasename(opts), util.generateResourcesPath(opts), 'app', path.basename(outDir)), function (exists) {
          t.false(exists, 'Out dir must not exist in output app directory')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createIgnoreImplicitOutDirTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'

    var appDir = util.getWorkCwd()
    opts.dir = appDir
    var outDir = opts.dir

    var testFilename = 'ignoreMe'
    var previousPackedResultDir

    series([
      function (cb) {
        fs.copy(util.fixtureSubdir('basic'), appDir, {dereference: true, stopOnErr: true, filter: function (file) {
          return path.basename(file) !== 'node_modules'
        }}, cb)
      },
      function (cb) {
        previousPackedResultDir = path.join(outDir, `${opts.name}-linux-ia32`)
        fs.mkdirp(previousPackedResultDir, cb)
      },
      function (cb) {
        // create file to ensure that directory will be not ignored because empty
        fs.open(path.join(previousPackedResultDir, testFilename), 'w', function (err, fd) {
          if (err) return cb(err)
          fs.close(fd, cb)
        })
      },
      function (cb) {
        packager(opts, cb)
      },
      function (cb) {
        fs.exists(path.join(outDir, common.generateFinalBasename(opts), util.generateResourcesPath(opts), 'app', testFilename), function (exists) {
          t.false(exists, 'Out dir must not exist in output app directory')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

util.testSinglePlatform('ignore test: string in array', createIgnoreTest, ['ignorethis'],
                        'ignorethis.txt')
util.testSinglePlatform('ignore test: string', createIgnoreTest, 'ignorethis', 'ignorethis.txt')
util.testSinglePlatform('ignore test: RegExp', createIgnoreTest, /ignorethis/, 'ignorethis.txt')
util.testSinglePlatform('ignore test: Function', createIgnoreTest,
                        function (file) { return file.match(/ignorethis/) }, 'ignorethis.txt')
util.testSinglePlatform('ignore test: string with slash', createIgnoreTest, 'ignore/this',
  path.join('ignore', 'this.txt'))
util.testSinglePlatform('ignore test: only match subfolder of app', createIgnoreTest,
                        'electron-packager', path.join('electron-packager', 'readme.txt'))
util.testSinglePlatform('ignore out dir test', createIgnoreOutDirTest, 'ignoredOutDir')
util.testSinglePlatform('ignore out dir test: unnormalized path', createIgnoreOutDirTest,
                        './ignoredOutDir')
util.testSinglePlatform('ignore out dir test: unnormalized path', createIgnoreImplicitOutDirTest)
