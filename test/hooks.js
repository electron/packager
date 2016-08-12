'use strict'

const config = require('./config.json')
const fs = require('fs')
const packager = require('..')
const series = require('run-series')
const test = require('tape')
const util = require('./util')
const waterfall = require('run-waterfall')

function verifyPackageExistence (finalPaths, callback) {
  series(finalPaths.map(function (finalPath) {
    return function (cb) {
      fs.stat(finalPath, cb)
    }
  }), function (err, statsResults) {
    if (err) return callback(null, false)

    callback(null, statsResults.every(function (stats) {
      return stats.isDirectory()
    }))
  })
}

function createHookTest (hookName) {
  util.setup()
  test('platform=all test (one arch) (' + hookName + ' hook)', function (t) {
    t.timeoutAfter(config.timeout * 2) // 2 packages will be built during this test

    var hookCalled = false
    var opts = {
      name: 'basicTest',
      dir: util.fixtureSubdir('basic'),
      version: config.version,
      arch: 'ia32',
      platform: 'all'
    }

    opts[hookName] = [function testHook (buildPath, electronVersion, platform, arch, callback) {
      hookCalled = true
      t.equal(electronVersion, opts.version, hookName + ' electronVersion should be the same as the options object')
      t.equal(arch, opts.arch, hookName + ' arch should be the same as the options object')
      callback()
    }]

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (finalPaths, cb) {
        t.equal(finalPaths.length, 2, 'packager call should resolve with expected number of paths')
        t.true(hookCalled, hookName + ' methods should have been called')
        verifyPackageExistence(finalPaths, cb)
      }, function (exists, cb) {
        t.true(exists, 'Packages should be generated for both 32-bit platforms')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  })
  util.teardown()
}

createHookTest('afterCopy')
createHookTest('afterExtract')
