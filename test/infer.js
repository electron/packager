'use strict'

const fs = require('fs-extra')
const { getMetadataFromPackageJSON } = require('../dist/infer')
const { packager } = require('../dist')
const path = require('path')
const semver = require('semver')
const test = require('ava')
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
  const { pkgUp } = await import('pkg-up')
  const tmpdirPkg = await pkgUp({ cwd: path.join(tmpdir, '..') })

  if (tmpdirPkg) {
    throw new Error(`Found package.json in parent of temp directory, which will interfere with test results. Please remove package.json at ${tmpdirPkg}`)
  }

  await fs.emptyDir(tmpdir)
  await fs.copy(fixtureDir, tmpdir)
  return tmpdir
}

async function inferFailureTest (t, opts, fixtureSubdir, errorMatcher) {
  opts.dir = await copyFixtureToTempDir(t, fixtureSubdir)
  delete opts.name
  delete opts.electronVersion

  return t.throwsAsync(packager(opts), { message: errorMatcher })
}

async function inferMissingVersionTest (t, opts) {
  opts.dir = await copyFixtureToTempDir(t, 'infer-missing-version-only')
  delete opts.electronVersion

  await getMetadataFromPackageJSON([], opts, opts.dir)
  const packageJSON = await fs.readJson(path.join(opts.dir, 'package.json'))
  t.is(opts.electronVersion, packageJSON.devDependencies.electron, 'The version should be inferred from installed electron module version')
}

async function testInferWin32metadata (t, opts, expected, assertionMessage) {
  opts.dir = await copyFixtureToTempDir(t, 'infer-win32metadata')

  await getMetadataFromPackageJSON(['win32'], opts, opts.dir)
  t.deepEqual(opts.win32metadata, expected, assertionMessage)
}

async function testInferWin32metadataAuthorObject (t, opts, author, expected, assertionMessage) {
  opts.dir = await copyFixtureToTempDir(t, 'infer-win32metadata')
  delete opts.name

  const packageJSONFilename = path.join(opts.dir, 'package.json')
  const packageJSON = await fs.readJson(packageJSONFilename)
  packageJSON.author = author
  await fs.writeJson(packageJSONFilename, packageJSON)
  await getMetadataFromPackageJSON(['win32'], opts, opts.dir)
  t.deepEqual(opts.win32metadata, expected, assertionMessage)
}

test('infer using `electron-nightly` package', util.testSinglePlatform(inferElectronVersionTest, 'infer-electron-nightly', 'electron-nightly'))
test('infer using `electron` package only', util.testSinglePlatform(inferMissingVersionTest))
test('infer win32metadata', util.testSinglePlatform(async (t, opts) => {
  const expected = { CompanyName: 'Foo Bar' }

  return testInferWin32metadata(t, opts, expected, 'win32metadata matches package.json values')
}))
test('do not infer win32metadata if it already exists', util.testSinglePlatform(async (t, opts) => {
  opts.win32metadata = { CompanyName: 'Existing' }
  opts.appVersion = '1.0.0'
  const expected = { ...opts.win32metadata }

  return testInferWin32metadata(t, opts, expected, 'win32metadata did not update with package.json values')
}))
test('infer win32metadata when author is an object', util.testSinglePlatform(async (t, opts) => {
  const author = {
    name: 'Foo Bar Object',
    email: 'foobar@example.com'
  }
  const expected = { CompanyName: 'Foo Bar Object' }

  return testInferWin32metadataAuthorObject(t, opts, author, expected, 'win32metadata did not update with package.json values')
}))
test('do not infer win32metadata.CompanyName when author is an object without a name', util.testSinglePlatform(async (t, opts) => {
  const author = {
    email: 'foobar@example.com'
  }
  const expected = {}

  return testInferWin32metadataAuthorObject(t, opts, author, expected, 'win32metadata.CompanyName should not have been inferred')
}))
test('infer: missing author for win32 target platform', util.testSinglePlatform(async (t, opts) => {
  opts.dir = await copyFixtureToTempDir(t, 'infer-win32metadata')
  opts.appVersion = '1.0.0'

  const packageJSONFilename = path.join(opts.dir, 'package.json')
  const packageJSON = await fs.readJson(packageJSONFilename)
  delete packageJSON.author
  await fs.writeJson(packageJSONFilename, packageJSON)
  await t.throwsAsync(getMetadataFromPackageJSON(['win32'], opts, opts.dir), { message: /following fields: author/ })
}))
test('missing name from package.json', util.testSinglePlatform(inferFailureTest, 'infer-missing-name', /^Unable to determine application name/))
test('missing Electron version from package.json', util.testSinglePlatform(inferFailureTest, 'infer-missing-electron-version', /^Unable to determine Electron version/))
test('missing package.json', util.testSinglePlatform(inferFailureTest, 'infer-missing-package-json', /^Could not locate a package\.json file/))
test('infer with bad fields', util.testSinglePlatform(inferFailureTest, 'infer-bad-fields', /^Unable to determine application version/))
test('infer with malformed JSON', util.testSinglePlatform(async (t, opts) => {
  opts.dir = await copyFixtureToTempDir(t, 'infer-malformed-json')
  delete opts.name
  delete opts.electronVersion

  const packageJSONFilename = path.join(opts.dir, 'package.json')
  const content = `${await fs.readFile(packageJSONFilename)}invalid`
  await fs.writeFile(packageJSONFilename, content)

  return t.throwsAsync(packager(opts), { message: /^Unexpected token/ })
}))
