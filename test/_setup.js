'use strict'

const common = require('../src/common')
const download = require('../src/download')
const { downloadArtifact } = require('@electron/get')
const config = require('./config.json')
const childProcess = require('child_process')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const targets = require('../src/targets')

childProcess.exec = promisify(childProcess.exec)

if (process.env.CI && process.platform === 'darwin') {
  // stub out rcedit due to Wine not being able to be configured in CI
  require('rcedit')
  require.cache[path.resolve(__dirname, '../node_modules/rcedit/lib/rcedit.js')].exports = function () {}
}

function fixtureSubdir (subdir) {
  return path.join(__dirname, 'fixtures', subdir)
}

/**
 * Skip testing darwin/mas target on Windows since Electron Packager itself skips it
 * (see https://github.com/electron/electron-packager/issues/71)
 */
function skipDownloadingMacZips (platform, arch) {
  return common.isPlatformMac(platform) && process.platform === 'win32'
}

async function downloadAll (version) {
  console.log(`Downloading Electron v${version} before running tests...`)
  const combinations = download.createDownloadCombos({ electronVersion: config.version, all: true }, targets.officialPlatforms, targets.officialArchs, skipDownloadingMacZips)

  await downloadElectronChecksum(version)
  return Promise.all(
    [
      ...combinations.map(combination => combination.arch === 'universal' ? null : downloadElectronZip(version, combination)),
      downloadElectronZip('6.0.0', {
        platform: 'darwin'
      })
    ]
  )
}

async function downloadElectronChecksum (version) {
  return downloadArtifact({
    isGeneric: true,
    version,
    artifactName: 'SHASUMS256.txt'
  })
}

async function downloadElectronZip (version, options) {
  return download.downloadElectronZip({
    ...options,
    artifactName: 'electron',
    cacheRoot: path.join(os.homedir(), '.electron'),
    version
  })
}

/**
 * Download all Electron distributions before running tests to avoid timing out due to
 * network speed.
 */
async function preDownloadElectron () {
  const versions = [
    config.version
  ]
  await Promise.all(versions.map(downloadAll))
}

const WORK_CWD = path.join(__dirname, 'work')

async function ensureEmptyWorkDirExists () {
  await fs.remove(WORK_CWD)
  await fs.mkdirs(WORK_CWD)
}

module.exports = {
  fixtureSubdir: fixtureSubdir,
  setupTestsuite: async function setupTestsuite () {
    try {
      await preDownloadElectron()
    } catch (error) {
      console.error(error.stack || error)
      return process.exit(1)
    }
    await ensureEmptyWorkDirExists()
  },
  WORK_CWD: WORK_CWD
}
