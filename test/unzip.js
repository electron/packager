'use strict'

const download = require('../src/download')
const unzip = require('../src/unzip')
const fs = require('fs-extra')
const config = require('./config.json')
const path = require('path')
const os = require('os')
const test = require('ava')

for (const downloadOpts of download.createDownloadCombos({ electronVersion: config.version }, ['darwin', 'mas'], ['x64'])) {
  test.serial(`unzip preserves symbolic links (${downloadOpts.platform})`, t => { return unzipPreserveSymbolicLinks(t, downloadOpts) })
}

async function unzipPreserveSymbolicLinks (t, downloadOpts) {
  const zipPath = await download.downloadElectronZip(downloadOpts)
  const tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'symlinktest-'))

  await unzip(zipPath, tempPath)

  const testSymlinkPath = path.join(tempPath, 'Electron.app/Contents/Frameworks/Electron Framework.framework/Libraries')
  const stat = await fs.lstat(testSymlinkPath)
  t.true(stat.isSymbolicLink(), 'extract symoblic links')
}
