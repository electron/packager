'use strict'

const { assertSymlink } = require('./_util')
const config = require('./config.json')
const { createDownloadOpts, downloadElectronZip } = require('../dist/download')
const path = require('path')
const test = require('ava')
const { extractElectronZip } = require('../dist/unzip')

test('extractElectronZip preserves symbolic links', async t => {
  const downloadOpts = createDownloadOpts({ electronVersion: config.version }, 'darwin', 'x64')
  const zipPath = await downloadElectronZip(downloadOpts)

  await extractElectronZip(zipPath, t.context.tempDir)

  await assertSymlink(t, path.join(t.context.tempDir, 'Electron.app/Contents/Frameworks/Electron Framework.framework/Libraries'), 'symbolic link extracted correctly')
})
