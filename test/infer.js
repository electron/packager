'use strict'

const fs = require('fs-extra')
const getMetadataFromPackageJSON = require('../src/infer')
const packager = require('..')
const path = require('path')
const pkgUp = require('pkg-up')
const semver = require('semver')
const util = require('./_util')

async function inferElectronVersionTest (t, opts, fixture, packageName) {
  delete opts.electronVersion
  opts.dir = util.fixtureSubdir(fixture)

  await getMetadataFromPackageJSON([], opts, opts.dir)
  const packageJSON = require(path.join(opts.dir, 'package.json'))
  return t.true(semver.satisfies(opts.electronVersion, packageJSON.devDependencies[packageName]), `The version should be inferred from installed ${packageName} version`)
}

async function copyFixtureToTempDir (t, fixtureSubdir) {
  const tmpdir = path.join(t.context.tempDir, fixtureSubdir)
  const fixtureDir = util.fixtureSubdir(fixtureSubdir)
  const tmpdirPkg = await pkgUp({ cwd: path.join(tmpdir, '..') })

  if (tmpdirPkg) {
    throw new Error(`Found package.json in parent of temp directory, which will interfere with test results. Please remove package.json at ${tmpdirPkg}`)
  }

  await fs.emptyDir(tmpdir)
  await fs.copy(fixtureDir, tmpdir)
  return tmpdir
}

async function inferFailureTest (t, opts, fixtureSubdir) {
  const dir = await copyFixtureToTempDir(t, fixtureSubdir)
  delete opts.name
  delete opts.electronVersion
  opts.dir = dir

  return t.throwsAsync(packager(opts))
}

async function inferMissingVersionTest (t, opts) {
  const dir = await copyFixtureToTempDir(t, 'infer-missing-version-only')
  delete opts.electronVersion
  opts.dir = dir

  await getMetadataFromPackageJSON([], opts, dir)
  const packageJSON = await fs.readJson(path.join(opts.dir, 'package.json'))
  t.is(opts.electronVersion, packageJSON.devDependencies['electron'], 'The version should be inferred from installed electron module version')
}

async function testInferWin32metadata (t, opts, expected, assertionMessage) {
  const dir = await copyFixtureToTempDir(t, 'infer-win32metadata')
  opts.dir = dir

  await getMetadataFromPackageJSON(['win32'], opts, dir)
  t.deepEqual(opts.win32metadata, expected, assertionMessage)
}

async function testInferWin32metadataAuthorObject (t, opts, author, expected, assertionMessage) {
  let packageJSONFilename

  delete opts.name

  const dir = await copyFixtureToTempDir(t, 'infer-win32metadata')
  opts.dir = dir

  packageJSONFilename = path.join(dir, 'package.json')
  const packageJSON = await fs.readJson(packageJSONFilename)
  packageJSON.author = author
  await fs.writeJson(packageJSONFilename, packageJSON)
  await getMetadataFromPackageJSON(['win32'], opts, opts.dir)
  t.deepEqual(opts.win32metadata, expected, assertionMessage)
}

util.testSinglePlatformParallel('infer using `electron-prebuilt` package', inferElectronVersionTest, 'basic', 'electron-prebuilt')
util.testSinglePlatformParallel('infer using `electron-nightly` package', inferElectronVersionTest, 'infer-electron-nightly', 'electron-nightly')
util.testSinglePlatformParallel('infer using `electron-prebuilt-compile` package', inferElectronVersionTest, 'infer-electron-prebuilt-compile', 'electron-prebuilt-compile')
util.testSinglePlatformParallel('infer using non-exact `electron-prebuilt-compile` package', inferElectronVersionTest, 'infer-non-specific-electron-prebuilt-compile', 'electron-prebuilt-compile')
util.testSinglePlatformParallel('infer using `electron` package only', inferMissingVersionTest)
util.testSinglePlatformParallel('infer where `electron` version is preferred over `electron-prebuilt`', inferElectronVersionTest, 'basic-renamed-to-electron', 'electron')
util.testSinglePlatformParallel('infer win32metadata', async (t, opts) => {
  const expected = { CompanyName: 'Foo Bar' }

  return testInferWin32metadata(t, opts, expected, 'win32metadata matches package.json values')
})
util.testSinglePlatformParallel('do not infer win32metadata if it already exists', async (t, opts) => {
  opts.win32metadata = { CompanyName: 'Existing' }
  const expected = { ...opts.win32metadata }

  return testInferWin32metadata(t, opts, expected, 'win32metadata did not update with package.json values')
})
util.testSinglePlatformParallel('infer win32metadata when author is an object', async (t, opts) => {
  const author = {
    name: 'Foo Bar Object',
    email: 'foobar@example.com'
  }
  const expected = { CompanyName: 'Foo Bar Object' }

  return testInferWin32metadataAuthorObject(t, opts, author, expected, 'win32metadata did not update with package.json values')
})
util.testSinglePlatformParallel('do not infer win32metadata.CompanyName when author is an object without a name', async (t, opts) => {
  const author = {
    email: 'foobar@example.com'
  }
  const expected = {}

  return testInferWin32metadataAuthorObject(t, opts, author, expected, 'win32metadata.CompanyName should not have been inferred')
})
util.testSinglePlatformParallel('infer missing fields test', inferFailureTest, 'infer-missing-fields')
util.testSinglePlatformParallel('infer with bad fields test', inferFailureTest, 'infer-bad-fields')
util.testSinglePlatformParallel('infer with malformed JSON test', inferFailureTest, 'infer-malformed-json')
util.testSinglePlatformParallel('infer using a non-specific `electron-prebuilt-compile` package version when the package did not have a main file', inferFailureTest, 'infer-invalid-non-specific-electron-prebuilt-compile')
