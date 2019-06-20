'use strict'

const common = require('../src/common')
const fs = require('fs-extra')
const ignore = require('../src/ignore')
const path = require('path')
const test = require('ava')
const util = require('./_util')

async function assertOutDirIgnored (t, opts, existingDirectoryPath, pathToIgnore, ignoredBasenameToCheck) {
  await fs.copy(util.fixtureSubdir('basic'), t.context.workDir, {
    dereference: true,
    stopOnErr: true,
    filter: file => path.basename(file) !== 'node_modules'
  })
  await fs.ensureDir(existingDirectoryPath)
  // create file to ensure that directory will be not ignored because it's empty
  await fs.writeFile(pathToIgnore, '')
  const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts)
  await util.assertPathNotExists(t, path.join(resourcesPath, 'app', ignoredBasenameToCheck), 'Out dir must not exist in output app directory')
}

async function copyDirToTempDirWithIgnores (t, opts) {
  ignore.generateIgnores(opts)
  const targetDir = path.join(t.context.tempDir, 'result')
  await fs.copy(opts.dir, targetDir, { dereference: false, filter: ignore.userIgnoreFilter(opts) })
  return targetDir
}

async function assertFileIgnored (t, targetDir, ignoredFile) {
  await util.assertPathNotExists(t, path.join(targetDir, ignoredFile), `Ignored file '${ignoredFile}' should not exist in copied directory`)
}

async function assertFileNotIgnored (t, targetDir, notIgnoredFile) {
  await util.assertPathExists(t, path.join(targetDir, notIgnoredFile), `The expected output directory should exist and contain ${notIgnoredFile}`)
}

async function ignoreTest (t, opts, ignorePattern, ignoredFile) {
  opts.dir = util.fixtureSubdir('basic')
  if (ignorePattern) {
    opts.ignore = ignorePattern
  }

  const targetDir = await copyDirToTempDirWithIgnores(t, opts)
  await assertFileIgnored(t, targetDir, ignoredFile)
  await assertFileNotIgnored(t, targetDir, 'package.json')
}

async function ignoreOutDirTest (t, opts, distPath) {
  opts.dir = t.context.workDir
  opts.name = 'ignoreOutDirTest'

  // create out dir before packager (real world issue - when second run includes unignored out dir)
  // we don't use path.join here to avoid normalizing
  opts.out = opts.dir + path.sep + distPath

  return assertOutDirIgnored(t, opts, opts.out, path.join(opts.out, 'ignoreMe'), path.basename(opts.out))
}

test('generateIgnores ignores the generated temporary directory only on Linux', t => {
  const tmpdir = '/foo/bar'
  const expected = path.join(tmpdir, 'electron-packager')
  let opts = { tmpdir }

  ignore.generateIgnores(opts)

  if (process.platform === 'linux') {
    t.true(opts.ignore.includes(expected), 'temporary dir in opts.ignore')
  } else {
    t.false(opts.ignore.includes(expected), 'temporary dir not in opts.ignore')
  }
})

test('generateOutIgnores ignores all possible platform/arch permutations', (t) => {
  const ignores = ignore.generateOutIgnores({ name: 'test' })
  t.is(ignores.length, util.allPlatformArchCombosCount)
})

test('ignore default: .o files', util.testSinglePlatform(ignoreTest, null, 'ignore.o'))
test('ignore default: .obj files', util.testSinglePlatform(ignoreTest, null, 'ignore.obj'))
test('ignore: string in array', util.testSinglePlatform(ignoreTest, ['ignorethis'], 'ignorethis.txt'))
test('ignore: string', util.testSinglePlatform(ignoreTest, 'ignorethis', 'ignorethis.txt'))
test('ignore: RegExp', util.testSinglePlatform(ignoreTest, /ignorethis/, 'ignorethis.txt'))
test('ignore: Function', util.testSinglePlatform(ignoreTest, file => file.match(/ignorethis/), 'ignorethis.txt'))
test('ignore: string with slash', util.testSinglePlatform(ignoreTest, 'ignore/this', path.join('ignore', 'this.txt')))
test('ignore: only match subfolder of app', util.testSinglePlatform(ignoreTest, 'electron-packager', path.join('electron-packager', 'readme.txt')))

test('ignore: junk by default', util.testSinglePlatform(async (t, opts) => {
  opts.dir = util.fixtureSubdir('ignore-junk')
  const targetDir = await copyDirToTempDirWithIgnores(t, opts)
  await assertFileIgnored(t, targetDir, 'subfolder/Thumbs.db')
}))
test('ignore: not junk when junk: false', util.testSinglePlatform(async (t, opts) => {
  opts.dir = util.fixtureSubdir('ignore-junk')
  opts.junk = false
  const targetDir = await copyDirToTempDirWithIgnores(t, opts)
  await assertFileNotIgnored(t, targetDir, 'subfolder/Thumbs.db')
}))

test.serial('ignore out dir', util.testSinglePlatform(ignoreOutDirTest, 'ignoredOutDir'))
test.serial('ignore out dir: unnormalized path', util.testSinglePlatform(ignoreOutDirTest, './ignoredOutDir'))
test.serial('ignore out dir: implicit path', util.testSinglePlatform(async (t, opts) => {
  opts.dir = t.context.workDir
  opts.name = 'ignoreImplicitOutDirTest'
  delete opts.out

  const testFilename = 'ignoreMe'
  const previousPackedResultDir = path.join(opts.dir, `${common.sanitizeAppName(opts.name)}-linux-ia32`)

  return assertOutDirIgnored(t, opts, previousPackedResultDir, path.join(previousPackedResultDir, testFilename), testFilename)
}))
test.serial('ignore out dir: relative out dir already exists', util.testSinglePlatform(async (t, opts) => {
  const oldCWD = process.cwd()
  const appDir = path.join(t.context.workDir, 'app')

  opts.name = 'ignoredOutDirTest'
  opts.dir = '.'
  opts.out = 'dir_to_unpack' // already existing out dir
  opts.overwrite = true

  await fs.copy(util.fixtureSubdir('basic'), appDir)
  process.chdir(appDir)
  const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts)
  process.chdir(oldCWD)
  const packagedOutDirPath = path.join(resourcesPath, 'app', opts.out)
  await util.assertPathNotExists(t, packagedOutDirPath, `The out dir ${packagedOutDirPath} should not exist in the packaged app`)
}))
