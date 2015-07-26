var fs = require('fs')
var path = require('path')

var packager = require('..')
var series = require('run-series')
var test = require('tape')
var waterfall = require('run-waterfall')

var config = require('./config.json')
var util = require('./util')

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

function createAllTest (version, expected, all, platform, arch) {
  return function (t) {
    t.timeoutAfter(config.timeout * expected) // expectde packages will be built during this test

    var opts = {
      name: 'basicTest',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      all: all,
      platform: platform,
      arch: arch,
      version: version
    }

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (finalPaths, cb) {
        // Windows skips packaging for OS X, and OS X only has 64-bit releases
        t.equal(finalPaths.length, process.platform === 'win32' && (all || platform === 'all') ? expected - 1 : expected,
          'packager call should resolve with expected number of paths')
        verifyPackageExistence(finalPaths, cb)
      }, function (exists, cb) {
        t.true(exists, 'Packages should be generated for all possible platforms')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

util.setup()
test('all test (v' + config.version + ')', createAllTest(config.version, 6, 'all'))
util.teardown()

util.setup()
test('all test (v0.28.3)', createAllTest('0.28.3', 5, 'all'))
util.teardown()

util.setup()
test('all test (v0.29.0)', createAllTest('0.29.0', 6, 'all'))
util.teardown()

util.setup()
test('arch=all test (one platform, v' + config.version + ')', createAllTest(config.version, 3, undefined, 'linux', 'all'))
util.teardown()

util.setup()
test('arch=all test (one platform, v0.28.3)', createAllTest('0.28.3', 2, undefined, 'linux', 'all'))
util.teardown()

util.setup()
test('arch=all test (one platform, v0.29.0)', createAllTest('0.29.0', 3, undefined, 'linux', 'all'))
util.teardown()

util.setup()
test('platform=all test (one arch)', createAllTest(config.version, 2, undefined, 'all', 'ia32'))
util.teardown()

function createMultiTest (arch, platform) {
  return function (t) {
    t.timeoutAfter(config.timeout * 4) // 4 packages will be built during this test

    var opts = {
      name: 'basicTest',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      version: config.version,
      arch: arch,
      platform: platform
    }

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (finalPaths, cb) {
        t.equal(finalPaths.length, 4, 'packager call should resolve with expected number of paths')
        verifyPackageExistence(finalPaths, cb)
      }, function (exists, cb) {
        t.true(exists, 'Packages should be generated for all combinations of specified archs and platforms')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

util.setup()
test('multi-platform / multi-arch test, from arrays', createMultiTest(['ia32', 'x64'], ['linux', 'win32']))
util.teardown()

util.setup()
test('multi-platform / multi-arch test, from strings', createMultiTest('ia32,x64', 'linux,win32'))
util.teardown()
