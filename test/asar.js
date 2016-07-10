'use strict'

const common = require('../common')
const config = require('./config.json')
const fs = require('fs-extra')
const packager = require('..')
const path = require('path')
const test = require('tape')
const util = require('./util')
const waterfall = require('run-waterfall')

function createDefaultAppAsarTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'el0374Test'
    opts.dir = path.join(__dirname, 'fixtures', 'el-0374')
    opts.version = '0.37.4'

    var resourcesPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        resourcesPath = path.join(paths[0], util.generateResourcesPath(opts))
        fs.exists(path.join(resourcesPath, 'default_app.asar'), function (exists) {
          t.false(exists, 'The output directory should not contain the Electron default_app.asar file')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createAsarTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')
    opts.asar = {
      'unpack': '*.pac',
      'unpackDir': 'dir_to_unpack'
    }
    var finalPath
    var resourcesPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        finalPath = paths[0]
        fs.stat(finalPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected output directory should exist')
        resourcesPath = path.join(finalPath, util.generateResourcesPath(opts))
        fs.stat(resourcesPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The output directory should contain the expected resources subdirectory')
        fs.stat(path.join(resourcesPath, 'app.asar'), cb)
      }, function (stats, cb) {
        t.true(stats.isFile(), 'app.asar should exist under the resources subdirectory when opts.asar is true')
        fs.exists(path.join(resourcesPath, 'app'), function (exists) {
          t.false(exists, 'app subdirectory should NOT exist when app.asar is built')
        })
        fs.stat(path.join(resourcesPath, 'app.asar.unpacked'), cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'app.asar.unpacked should exist under the resources subdirectory when opts.asar_unpack is set some expression')
        fs.stat(path.join(resourcesPath, 'app.asar.unpacked', 'dir_to_unpack'), cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'dir_to_unpack should exist under app.asar.unpacked subdirectory when opts.asar-unpack-dir is set dir_to_unpack')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

test('asar argument test: asar is not set', function (t) {
  var opts = {}

  var asarOpts = common.createAsarOpts(opts)
  t.false(asarOpts, 'createAsarOpts returns false')
  t.end()
})

test('asar argument test: asar is true', function (t) {
  var opts = {
    asar: true
  }

  var asarOpts = common.createAsarOpts(opts)
  t.same(asarOpts, {unpack: undefined, unpackDir: undefined})
  t.end()
})

test('asar argument test: asar is not an Object or a bool', function (t) {
  var opts = {
    asar: 'string'
  }

  var asarOpts = common.createAsarOpts(opts)
  t.false(asarOpts, 'createAsarOpts returns false')
  t.end()
})

test('asar argument test: asar-unpack still works albeit deprecated', function (t) {
  var opts = {
    asar: true,
    'asar-unpack': 'deprecated'
  }

  var asarOpts = common.createAsarOpts(opts)
  t.same(asarOpts, {unpack: 'deprecated', unpackDir: undefined})
  t.end()
})

test('asar argument test: asar.unpack overwrites asar-unpack', function (t) {
  var opts = {
    asar: {
      unpack: 'should exist'
    },
    'asar-unpack': 'should not exist'
  }

  var asarOpts = common.createAsarOpts(opts)
  t.same(asarOpts, {unpack: 'should exist', unpackDir: undefined})
  t.end()
})

test('asar argument test: asar-unpack-dir still works albeit deprecated', function (t) {
  var opts = {
    asar: true,
    'asar-unpack-dir': 'deprecated'
  }

  var asarOpts = common.createAsarOpts(opts)
  t.same(asarOpts, {unpack: undefined, unpackDir: 'deprecated'})
  t.end()
})

test('asar argument test: asar.unpackDir overwrites asar-unpack-dir', function (t) {
  var opts = {
    asar: {
      unpackDir: 'should exist'
    },
    'asar-unpack-dir': 'should not exist'
  }

  var asarOpts = common.createAsarOpts(opts)
  t.same(asarOpts, {unpack: undefined, unpackDir: 'should exist'})
  t.end()
})

util.testSinglePlatform('default_app.asar removal test', createDefaultAppAsarTest)
util.testSinglePlatform('asar test', createAsarTest)
