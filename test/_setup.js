'use strict'

const common = require('../src/common')
const download = require('../src/download')
const config = require('./config.json')
const childProcess = require('child_process')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const targets = require('../src/targets')

childProcess.exec = promisify(childProcess.exec)

function fixtureSubdir (subdir) {
  return path.join(__dirname, 'fixtures', subdir)
}

/**
 * Skip testing darwin/mas target on Windows since Electron Packager itself skips it
 * (see https://github.com/electron-userland/electron-packager/issues/71)
 */
function skipDownloadingMacZips (platform, arch) {
  return common.isPlatformMac(platform) && process.platform === 'win32'
}

async function downloadAll (version) {
  console.log(`Downloading Electron v${version} before running tests...`)
  const combinations = download.createDownloadCombos({ electronVersion: config.version, all: true }, targets.officialPlatforms, targets.officialArchs, skipDownloadingMacZips)

  return Promise.all(combinations.map(combination => downloadElectronZip(version, combination)))
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
