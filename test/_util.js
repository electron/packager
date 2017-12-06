'use strict'

// Keeping this module because it handles non-buffers gracefully
const bufferEqual = require('buffer-equal')
const common = require('../common')
const config = require('./config.json')
const exec = require('mz/child_process').exec
const fs = require('fs-extra')
const os = require('os')
const packager = require('../index')
const path = require('path')
const targets = require('../targets')
const tempy = require('tempy')
const test = require('ava')

function downloadAll (version) {
  console.log(`Calling electron-download for ${version} before running tests...`)
  const combinations = common.createDownloadCombos({electronVersion: config.version, all: true}, targets.officialPlatforms, targets.officialArchs, (platform, arch) => {
    // Skip testing darwin/mas target on Windows since electron-packager itself skips it
    // (see https://github.com/electron-userland/electron-packager/issues/71)
    return common.isPlatformMac(platform) && process.platform === 'win32'
  })

  return Promise.all(combinations.map(combination => {
    return common.downloadElectronZip(Object.assign({}, combination, {
      cache: path.join(os.homedir(), '.electron'),
      quiet: !!process.env.CI,
      version: version
    }))
  }))
}

// Download all Electron distributions before running tests to avoid timing out due to network
// speed. Most tests run with the config.json version, but we have some tests using 0.37.4, and an
// electron module specific test using 1.3.1.
function preDownloadElectron () {
  const versions = [
    config.version,
    '0.37.4',
    '1.3.1'
  ]
  return Promise.all(versions.map(downloadAll))
}

function npmInstallForFixture (fixture) {
  const fixtureDir = exports.fixtureSubdir(fixture)
  return fs.exists(path.join(fixtureDir, 'node_modules'))
    .then(exists => {
      if (exists) {
        return true
      } else {
        console.log(`Running npm install in fixtures/${fixture}...`)
        return exec('npm install --no-bin-links', {cwd: fixtureDir})
      }
    })
}

function npmInstallForFixtures () {
  const fixtures = [
    'basic',
    'basic-renamed-to-electron',
    'infer-missing-version-only',
    'el-0374'
  ]
  return Promise.all(fixtures.map(npmInstallForFixture))
}

const ORIGINAL_CWD = process.cwd()
const WORK_CWD = path.join(__dirname, 'work')

function ensureEmptyWorkDirExists () {
  return fs.remove(WORK_CWD)
    .then(() => fs.mkdirs(WORK_CWD))
    .then(() => process.chdir(WORK_CWD))
}

test.before(t =>
  preDownloadElectron()
    .then(npmInstallForFixtures)
    .catch(error => {
      console.error(error.stack || error)
      return process.exit(1)
    })
    .then(ensureEmptyWorkDirExists)
)

test.after.always(t => {
  process.chdir(ORIGINAL_CWD)
  return fs.remove(WORK_CWD)
})

test.beforeEach(t => {
  t.context.workDir = tempy.directory()
  t.context.tempDir = tempy.directory()
})

test.afterEach.always(t => {
  return fs.remove(t.context.workDir)
    .then(() => fs.remove(t.context.tempDir))
})

exports.allPlatformArchCombosCount = 8

exports.areFilesEqual = function areFilesEqual (file1, file2) {
  let buffer1, buffer2

  return fs.readFile(file1)
    .then((data) => {
      buffer1 = data
      return fs.readFile(file2)
    }).then((data) => {
      buffer2 = data
      return bufferEqual(buffer1, buffer2)
    })
}

exports.fixtureSubdir = function fixtureSubdir (subdir) {
  return path.join(__dirname, 'fixtures', subdir)
}

exports.generateResourcesPath = function generateResourcesPath (opts) {
  return common.isPlatformMac(opts.platform)
    ? path.join(opts.name + '.app', 'Contents', 'Resources')
    : 'resources'
}

exports.invalidOptionTest = function invalidOptionTest (opts) {
  return t => t.throws(packager(opts))
}

exports.packageAndEnsureResourcesPath = function packageAndEnsureResourcesPath (t, opts) {
  let resourcesPath

  return packager(opts)
    .then(paths => {
      resourcesPath = path.join(paths[0], exports.generateResourcesPath(opts))
      return fs.stat(resourcesPath)
    }).then(stats => {
      t.true(stats.isDirectory(), 'The output directory should contain the expected resources subdirectory')
      return resourcesPath
    })
}

exports.packagerTest = function packagerTest (name, testFunction) {
  test.serial(name, t => {
    const opts = {
      name: 'packagerTest',
      out: t.context.workDir,
      tmpdir: t.context.tempDir
    }
    return testFunction(t, opts)
  })
}

// Rest parameters are added (not behind a feature flag) in Node 6
exports.testSinglePlatform = function testSinglePlatform (name, testFunction /*, ...testFunctionArgs */) {
  const args = Array.prototype.slice.call(arguments, 2)
  exports.packagerTest(name, (t, opts) => {
    Object.assign(opts, {platform: 'linux', arch: 'x64', electronVersion: config.version})
    return testFunction.apply(null, [t, opts].concat(args))
  })
}

exports.verifyPackageExistence = function verifyPackageExistence (finalPaths) {
  return Promise.all(finalPaths.map((finalPath) => {
    return fs.stat(finalPath)
      .then(
        stats => stats.isDirectory(),
        () => false
      )
  }))
}
