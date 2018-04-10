'use strict'

const common = require('../common')
const path = require('path')
const test = require('ava')
const sinon = require('sinon')
const util = require('./_util')

test('asar argument test: asar is not set', t => {
  const asarOpts = common.createAsarOpts({})
  t.false(asarOpts, 'createAsarOpts returns false')
})

test('asar argument test: asar is true', t => {
  t.deepEqual(common.createAsarOpts({asar: true}), {})
})

test('asar argument test: asar is not an Object or a bool', t => {
  t.false(common.createAsarOpts({asar: 'string'}), 'createAsarOpts returns false')
})

util.testSinglePlatform('default_app.asar removal test', (t, opts) => {
  opts.name = 'default_appASARTest'
  opts.dir = util.fixtureSubdir('el-0374')
  opts.electronVersion = '0.37.4'

  return util.packageAndEnsureResourcesPath(t, opts)
    .then(resourcesPath => util.assertPathNotExists(t, path.join(resourcesPath, 'default_app.asar'), 'The output directory should not contain the Electron default_app.asar file'))
})

function assertUnpackedAsar (t, resourcesPath) {
  return util.assertDirectory(t, path.join(resourcesPath, 'app.asar.unpacked'), 'app.asar.unpacked should exist under the resources subdirectory when opts.asar_unpack is set')
    .then(() => util.assertDirectory(t, path.join(resourcesPath, 'app.asar.unpacked', 'dir_to_unpack'), 'dir_to_unpack should exist under app.asar.unpacked subdirectory when opts.asar-unpack-dir is set dir_to_unpack'))
}

util.testSinglePlatform('asar test', (t, opts) => {
  opts.name = 'asarTest'
  opts.dir = util.fixtureSubdir('basic')
  opts.asar = {
    'unpack': '*.pac',
    'unpackDir': 'dir_to_unpack'
  }

  return util.packageAndEnsureResourcesPath(t, opts)
    .then(resourcesPath => {
      return Promise.all([
        util.assertFile(t, path.join(resourcesPath, 'app.asar'), 'app.asar should exist under the resources subdirectory when opts.asar is true'),
        util.assertPathNotExists(t, path.join(resourcesPath, 'app'), 'app subdirectory should NOT exist when app.asar is built'),
        assertUnpackedAsar(t, resourcesPath)
      ])
    })
})

util.testSinglePlatform('prebuilt asar test', (t, opts) => {
  opts.name = 'prebuiltAsarTest'
  opts.dir = util.fixtureSubdir('asar-prebuilt')
  opts.prebuiltAsar = path.join(opts.dir, 'app.asar')
  opts.asar = {
    'unpack': '*.pac',
    'unpackDir': 'dir_to_unpack'
  }
  opts.ignore = ['foo']
  opts.prune = false
  opts.derefSymlinks = false
  sinon.spy(console, 'warn')

  let resourcesPath
  return util.packageAndEnsureResourcesPath(t, opts)
    .then(generatedResourcesPath => {
      const asarOptsWarn = 'WARNING: prebuiltAsar has been specified, all asar options will be ignored'
      const ignoreWarn = 'WARNING: prebuiltAsar and ignore are incompatible. Ignoring ignore'
      const pruneWarn = 'WARNING: prebuiltAsar and prune are incompatible. Ignoring prune'
      const derefWarn = 'WARNING: prebuiltAsar and derefSymlinks are incompatible. Ignoring derefSymlinks'

      t.true(
        console.warn.calledWithExactly(asarOptsWarn),
        `console.warn should be called with: ${asarOptsWarn}`)
      t.true(
        console.warn.calledWithExactly(ignoreWarn),
        `console.warn should be called with: ${ignoreWarn}`)
      t.true(
        console.warn.calledWithExactly(pruneWarn),
        `console.warn should be called with: ${pruneWarn}`)
      t.true(
        console.warn.calledWithExactly(derefWarn),
        `console.warn should be called with: ${derefWarn}`)

      resourcesPath = generatedResourcesPath
      return fs.stat(path.join(resourcesPath, 'app.asar'))
    }).then(stats => {
      t.true(stats.isFile(), 'app.asar should exist under the resources subdirectory when opts.prebuiltAsar points to a prebuilt asar')
      return util.areFilesEqual(opts.prebuiltAsar, path.join(resourcesPath, 'app.asar'))
    }).then(eql => {
      t.true(eql, 'app.asar should equal the prebuilt asar')
      return fs.pathExists(path.join(resourcesPath, 'app'))
    }).then(exists => t.false(exists, 'app subdirectory should NOT exist when app.asar is built'))
})

util.testSinglePlatform('prebuilt asar test - fail on directory', (t, opts) => {
  opts.name = 'prebuiltAsarFailingTest'
  opts.dir = util.fixtureSubdir('asar-prebuilt')
  opts.prebuiltAsar = opts.dir

  return util.packageAndEnsureResourcesPath(t, opts)
    .then(() => t.fail('Specifying a directory for prebuiltAsar should throw an exception'))
    .catch(er => t.regex(er.message, /must be an asar file/))
})

util.testSinglePlatform('prebuilt asar test - fail if afterCopy specified', (t, opts) => {
  opts.name = 'prebuiltAsarFailingTest'
  opts.dir = util.fixtureSubdir('asar-prebuilt')
  opts.prebuiltAsar = opts.dir
  opts.afterCopy = []

  return util.packageAndEnsureResourcesPath(t, opts)
    .then(() => t.fail('Specifying prebuiltAsar and afterCopy should throw an exception'))
    .catch(er => t.regex(er.message, /is incompatible with prebuiltAsar/))
})

util.testSinglePlatform('prebuilt asar test - fail if afterPrune specified', (t, opts) => {
  opts.name = 'prebuiltAsarFailingTest'
  opts.dir = util.fixtureSubdir('asar-prebuilt')
  opts.prebuiltAsar = opts.dir
  opts.afterPrune = []

  return util.packageAndEnsureResourcesPath(t, opts)
    .then(() => t.fail('Specifying prebuiltAsar and afterPrune should throw an exception'))
    .catch(er => t.regex(er.message, /is incompatible with prebuiltAsar/))
})
