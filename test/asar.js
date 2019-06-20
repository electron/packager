'use strict'

const common = require('../src/common')
const path = require('path')
const test = require('ava')
const util = require('./_util')

test('asar argument test: asar is not set', t => {
  const asarOpts = common.createAsarOpts({})
  t.false(asarOpts, 'createAsarOpts returns false')
})

test('asar argument test: asar is true', t => {
  t.deepEqual(common.createAsarOpts({ asar: true }), {})
})

test('asar argument test: asar is not an Object or a bool', t => {
  t.false(common.createAsarOpts({ asar: 'string' }), 'createAsarOpts returns false')
})

test.serial('default_app.asar removal test', util.testSinglePlatform(async (t, opts) => {
  opts.name = 'default_appASARTest'
  opts.dir = util.fixtureSubdir('basic')

  const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts)
  await util.assertPathNotExists(t, path.join(resourcesPath, 'default_app.asar'), 'The output directory should not contain the Electron default_app.asar file')
}))

async function assertUnpackedAsar (t, resourcesPath) {
  await util.assertDirectory(t, path.join(resourcesPath, 'app.asar.unpacked'), 'app.asar.unpacked should exist under the resources subdirectory when opts.asar_unpack is set')
  await util.assertDirectory(t, path.join(resourcesPath, 'app.asar.unpacked', 'dir_to_unpack'), 'dir_to_unpack should exist under app.asar.unpacked subdirectory when opts.asar-unpack-dir is set dir_to_unpack')
}

function failedPrebuiltAsarTest (extraOpts, errorRegex) {
  const dir = util.fixtureSubdir('asar-prebuilt')
  return util.invalidOptionTest({
    name: 'prebuiltAsarFailingTest',
    dir: dir,
    prebuiltAsar: path.join(dir, 'app.asar'),
    ...extraOpts
  }, errorRegex)
}

function incompatibleOptionWithPrebuiltAsarTest (extraOpts) {
  return failedPrebuiltAsarTest(extraOpts, /is incompatible with prebuiltAsar/)
}

test.serial('asar test', util.testSinglePlatform(async (t, opts) => {
  opts.name = 'asarTest'
  opts.dir = util.fixtureSubdir('basic')
  opts.asar = {
    'unpack': '*.pac',
    'unpackDir': 'dir_to_unpack'
  }

  const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts)
  await Promise.all([
    util.assertFile(t, path.join(resourcesPath, 'app.asar'), 'app.asar should exist under the resources subdirectory when opts.asar is true'),
    util.assertPathNotExists(t, path.join(resourcesPath, 'app'), 'app subdirectory should NOT exist when app.asar is built'),
    assertUnpackedAsar(t, resourcesPath)
  ])
}))

test.serial('prebuilt asar test', util.testSinglePlatform(async (t, opts) => {
  util.setupConsoleWarnSpy()
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

  const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts)
  util.assertWarning(t, 'WARNING: prebuiltAsar has been specified, all asar options will be ignored')
  for (const incompatibleOption of ['ignore', 'prune', 'derefSymlinks']) {
    util.assertWarning(t, `WARNING: prebuiltAsar and ${incompatibleOption} are incompatible, ignoring the ${incompatibleOption} option`)
  }

  await util.assertFile(t, path.join(resourcesPath, 'app.asar'), 'app.asar should exist under the resources subdirectory when opts.prebuiltAsar points to a prebuilt asar')
  await util.assertFilesEqual(t, opts.prebuiltAsar, path.join(resourcesPath, 'app.asar'), 'app.asar should equal the prebuilt asar')
  await util.assertPathNotExists(t, path.join(resourcesPath, 'app'), 'app subdirectory should NOT exist when app.asar is built')
}))

test('prebuiltAsar: fail when set to directory', failedPrebuiltAsarTest({ prebuiltAsar: util.fixtureSubdir('asar-prebuilt') }, /must be an asar file/))
test('prebuiltAsar: fail when specifying afterCopy', incompatibleOptionWithPrebuiltAsarTest({ afterCopy: [] }))
test('prebuiltAsar: fail when specifying afterPrune', incompatibleOptionWithPrebuiltAsarTest({ afterPrune: [] }))
