'use strict'

const config = require('./config.json')
const fs = require('fs')
const isAdmin = require('is-admin')
const packager = require('..')
const series = require('run-series')
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

function createMultiTest (arch, platform) {
  return (t) => {
    // 4 packages will be built during this test
    t.timeoutAfter(config.timeout * 4)

    var opts = {
      name: 'basicTest',
      dir: util.fixtureSubdir('basic'),
      version: config.version,
      arch: arch,
      platform: platform
    }

    waterfall([
      (cb) => {
        packager(opts, cb)
      }, (finalPaths, cb) => {
        t.equal(finalPaths.length, 4, 'packager call should resolve with expected number of paths')
        verifyPackageExistence(finalPaths, cb)
      }, (exists, cb) => {
        t.true(exists, 'Packages should be generated for all combinations of specified archs and platforms')
        cb()
      }
    ], (err) => {
      t.end(err)
    })
  }
}

util.packagerTest('all test', (t) => {
  t.timeoutAfter(config.timeout * 7) // 5-7 packages will be built during this test

  var opts = {
    name: 'basicTest',
    dir: util.fixtureSubdir('basic'),
    version: config.version,
    all: true
  }

  var expectedAppCount = 7

  waterfall([
    function (cb) {
      if (process.platform === 'win32') {
        isAdmin().then((admin) => {
          if (!admin) expectedAppCount = 5
          cb()
        })
      } else {
        cb()
      }
    }, function (cb) {
      packager(opts, cb)
    }, function (finalPaths, cb) {
      // OS X only has 64-bit releases
      t.equal(finalPaths.length, expectedAppCount,
        'packager call should resolve with expected number of paths')
      verifyPackageExistence(finalPaths, cb)
    }, function (exists, cb) {
      t.true(exists, 'Packages should be generated for all possible platforms')
      cb()
    }
  ], function (err) {
    t.end(err)
  })
})

util.packagerTest('platform=all test (one arch)', function (t) {
  t.timeoutAfter(config.timeout * 2) // 2 packages will be built during this test

  var opts = {
    name: 'basicTest',
    dir: util.fixtureSubdir('basic'),
    version: config.version,
    arch: 'ia32',
    platform: 'all'
  }

  waterfall([
    function (cb) {
      packager(opts, cb)
    }, function (finalPaths, cb) {
      t.equal(finalPaths.length, 2, 'packager call should resolve with expected number of paths')
      verifyPackageExistence(finalPaths, cb)
    }, function (exists, cb) {
      t.true(exists, 'Packages should be generated for both 32-bit platforms')
      cb()
    }
  ], function (err) {
    t.end(err)
  })
})

util.packagerTest('arch=all test (one platform)', (t) => {
  const LINUX_ARCH_COUNT = 3
  t.timeoutAfter(config.timeout * LINUX_ARCH_COUNT)

  var opts = {
    name: 'basicTest',
    dir: util.fixtureSubdir('basic'),
    version: config.version,
    arch: 'all',
    platform: 'linux'
  }

  waterfall([
    function (cb) {
      packager(opts, cb)
    }, function (finalPaths, cb) {
      t.equal(finalPaths.length, LINUX_ARCH_COUNT, 'packager call should resolve with expected number of paths')
      verifyPackageExistence(finalPaths, cb)
    }, function (exists, cb) {
      t.true(exists, 'Packages should be generated for all expected architectures')
      cb()
    }
  ], function (err) {
    t.end(err)
  })
})

util.packagerTest('multi-platform / multi-arch test, from arrays', createMultiTest(['ia32', 'x64'], ['linux', 'win32']))
util.packagerTest('multi-platform / multi-arch test, from strings', createMultiTest('ia32,x64', 'linux,win32'))
