'use strict'

const common = require('./common')
const debug = require('debug')('electron-packager')
const extract = require('extract-zip')
const fs = require('fs-extra')
const getMetadataFromPackageJSON = require('./infer')
const ignore = require('./ignore')
const metadata = require('./package.json')
const nodeify = require('nodeify')
const path = require('path')
const pify = require('pify')
const targets = require('./targets')

function debugHostInfo () {
  debug(`Electron Packager ${metadata.version}`)
  debug(`Node ${process.version}`)
  debug(`Host Operating system: ${process.platform} (${process.arch})`)
}

function ensureTempDir (useTempDir, tempBase) {
  if (useTempDir) {
    return fs.remove(tempBase)
  } else {
    return Promise.resolve()
  }
}

function testSymlink (tempBase) {
  const testPath = path.join(tempBase, 'symlink-test')
  const testFile = path.join(testPath, 'test')
  const testLink = path.join(testPath, 'testlink')

  const cleanup = (symlinksWork) => fs.remove(testPath).then(() => symlinksWork)

  return fs.outputFile(testFile, '')
    .then(() => fs.symlink(testFile, testLink))
    .then(() => cleanup(true))
    .catch(() => cleanup(false))
}

function createApp (comboOpts, opts, useTempDir, tempBase) {
  let buildParentDir
  if (useTempDir) {
    buildParentDir = tempBase
  } else {
    buildParentDir = opts.out || process.cwd()
  }
  var buildDir = path.resolve(buildParentDir, `${comboOpts.platform}-${comboOpts.arch}-template`)
  common.info(`Packaging app for platform ${comboOpts.platform} ${comboOpts.arch} using electron v${comboOpts.version}`, opts.quiet)

  debug(`Creating ${buildDir}`)
  return fs.ensureDir(buildDir)
    .then(() => {
      debug(`Extracting ${comboOpts.zipPath} to ${buildDir}`)
      return pify(extract)(comboOpts.zipPath, { dir: buildDir })
    }).then(() => common.promisifyHooks(opts.afterExtract, [buildDir, comboOpts.version, comboOpts.platform, comboOpts.arch]))
    .then(() => require(targets.osModules[comboOpts.platform]).createApp(Object.assign({}, opts, comboOpts), buildDir))
}

function checkOverwrite (comboOpts, opts, useTempDir, tempBase) {
  const finalPath = common.generateFinalPath(opts)
  return fs.pathExists(finalPath)
    .then(exists => {
      if (exists) {
        if (opts.overwrite) {
          return fs.remove(finalPath)
            .then(() => createApp(comboOpts, opts, useTempDir, tempBase))
        } else {
          common.info(`Skipping ${comboOpts.platform} ${comboOpts.arch} (output dir already exists, use --overwrite to force)`, opts.quiet)
          return true
        }
      } else {
        return createApp(comboOpts, opts, useTempDir, tempBase)
      }
    })
}

function packageForPlatformAndArch (combination, opts, useTempDir, tempBase) {
  return common.downloadElectronZip(combination)
    .then(zipPath => {
      // Create delegated options object with specific platform and arch, for output directory naming
      const comboOpts = Object.assign({}, opts, {
        arch: combination.arch,
        platform: combination.platform,
        version: combination.version,
        afterCopy: opts.afterCopy, // WTF?
        afterPrune: opts.afterPrune,
        zipPath: zipPath
      })

      if (!useTempDir) {
        return createApp(comboOpts, opts, useTempDir, tempBase)
      }

      if (common.isPlatformMac(combination.platform)) {
        return testSymlink(tempBase)
          .then(result => {
            if (result) return checkOverwrite(comboOpts, opts, useTempDir, tempBase)

            common.info(`Cannot create symlinks (on Windows hosts, it requires admin privileges); skipping ${combination.platform} platform`, opts.quiet)
            return Promise.resolve()
          })
      } else {
        return checkOverwrite(comboOpts, opts, useTempDir, tempBase)
      }
    })
}

function runPackager (opts, archs, platforms) {
  const tempBase = common.baseTempDir(opts)
  const useTempDir = opts.tmpdir !== false

  return ensureTempDir(useTempDir, tempBase)
    .then(() => Promise.all(common.createDownloadCombos(opts, platforms, archs).map(
      combination => packageForPlatformAndArch(combination, opts, useTempDir, tempBase)
    )))
}

function packagerPromise (opts) {
  debugHostInfo()
  if (debug.enabled) debug(`Packager Options: ${JSON.stringify(opts)}`)

  let archs = targets.validateListFromOptions(opts, 'arch')
  let platforms = targets.validateListFromOptions(opts, 'platform')
  if (!Array.isArray(archs)) return Promise.reject(archs)
  if (!Array.isArray(platforms)) return Promise.reject(platforms)

  debug(`Target Platforms: ${platforms.join(', ')}`)
  debug(`Target Architectures: ${archs.join(', ')}`)

  const packageJSONDir = path.resolve(process.cwd(), opts.dir) || process.cwd()

  return getMetadataFromPackageJSON(platforms, opts, packageJSONDir)
    .then(() => {
      if (opts.name.endsWith(' Helper')) {
        throw new Error('Application names cannot end in " Helper" due to limitations on macOS')
      }

      debug(`Application name: ${opts.name}`)
      debug(`Target Electron version: ${opts.electronVersion}`)

      ignore.generateIgnores(opts)

      return runPackager(opts, archs, platforms)
    })
    // Remove falsy entries (e.g. skipped platforms)
    .then(appPaths => appPaths.filter(appPath => appPath))
}

module.exports = function packager (opts, cb) {
  return nodeify(packagerPromise(opts), cb)
}
