'use strict'

// Keeping this module because it handles non-buffers gracefully
const bufferEqual = require('buffer-equal')
const common = require('../src/common')
const config = require('./config.json')
const fs = require('fs-extra')
const packager = require('..')
const path = require('path')
const plist = require('plist')
const setup = require('./_setup')
const sinon = require('sinon')
const tempy = require('tempy')
const test = require('ava')

const ORIGINAL_CWD = process.cwd()

test.before(async t => {
  if (!process.env.CI) {
    await setup.setupTestsuite()
    process.chdir(setup.WORK_CWD)
  }
  return Promise.resolve(process.chdir(setup.WORK_CWD))
})

test.after.always(async t => {
  process.chdir(ORIGINAL_CWD)
  await fs.remove(setup.WORK_CWD)
})

test.beforeEach(t => {
  t.context.workDir = tempy.directory()
  t.context.tempDir = tempy.directory()
})

test.afterEach.always(async t => {
  await fs.remove(t.context.workDir)
  await fs.remove(t.context.tempDir)
})

function packagerTestOptions (t) {
  return {
    name: 'packagerTest',
    out: t.context.workDir,
    tmpdir: t.context.tempDir
  }
}

module.exports = {
  allPlatformArchCombosCount: 9,
  assertDirectory: async function assertDirectory (t, pathToCheck, message) {
    const stats = await fs.stat(pathToCheck)
    t.true(stats.isDirectory(), message)
  },
  assertFile: async function assertFile (t, pathToCheck, message) {
    const stats = await fs.stat(pathToCheck)
    t.true(stats.isFile(), message)
  },
  assertFilesEqual: async function assertFilesEqual (t, file1, file2, message) {
    const [buffer1, buffer2] = await Promise.all([fs.readFile(file1), fs.readFile(file2)])
    t.true(bufferEqual(buffer1, buffer2), message)
  },
  assertPathExistsCustom: async function assertPathExistsCustom (t, pathToCheck, expected, message) {
    const actual = await fs.pathExists(pathToCheck)
    t.is(expected, actual, message)
  },
  assertPathExists: async function assertPathExists (t, pathToCheck, message) {
    await module.exports.assertPathExistsCustom(t, pathToCheck, true, message)
  },
  assertPathNotExists: async function assertPathNotExists (t, pathToCheck, message) {
    await module.exports.assertPathExistsCustom(t, pathToCheck, false, message)
  },
  assertSymlink: async function assertFile (t, pathToCheck, message) {
    const stats = await fs.lstat(pathToCheck)
    t.true(stats.isSymbolicLink(), message)
  },
  assertWarning: function assertWarning (t, message) {
    t.true(console.warn.calledWithExactly(message), `console.warn should be called with: ${message}`)
  },
  fixtureSubdir: setup.fixtureSubdir,
  generateResourcesPath: function generateResourcesPath (opts) {
    if (common.isPlatformMac(opts.platform)) {
      return path.join(opts.name + '.app', 'Contents', 'Resources')
    } else {
      return 'resources'
    }
  },
  invalidOptionTest: function invalidOptionTest (opts, err, message) {
    return t => t.throwsAsync(packager({ ...packagerTestOptions(t), ...opts }), err || null, message)
  },
  packageAndEnsureResourcesPath: async function packageAndEnsureResourcesPath (t, opts) {
    const paths = await packager(opts)
    const resourcesPath = path.join(paths[0], module.exports.generateResourcesPath(opts))
    await module.exports.assertDirectory(t, resourcesPath, 'The output directory should contain the expected resources subdirectory')
    return resourcesPath
  },
  packagerTest: function packagerTest (testFunction) {
    return t => testFunction(t, packagerTestOptions(t))
  },
  parsePlist: async function parsePlist (t, appPath) {
    const plistPath = path.join(appPath, 'Contents', 'Info.plist')

    await module.exports.assertFile(t, plistPath, `The expected Info.plist should exist in ${path.basename(appPath)}`)
    return plist.parse(await fs.readFile(plistPath, 'utf8'))
  },
  setupConsoleWarnSpy: function setupConsoleWarnSpy () {
    if (console.warn.restore) {
      console.warn.resetHistory()
    } else {
      sinon.spy(console, 'warn')
    }
  },
  testSinglePlatform: function (testFunction, ...testFunctionArgs) {
    return t => testFunction(t, {
      ...packagerTestOptions(t),
      platform: 'linux',
      arch: 'x64',
      electronVersion: config.version
    }, ...testFunctionArgs)
  },
  verifyPackageExistence: async function verifyPackageExistence (finalPaths) {
    return Promise.all(finalPaths.map(async finalPath => {
      try {
        return (await fs.stat(finalPath)).isDirectory()
      } catch (_err) {
        return false
      }
    }))
  }
}
