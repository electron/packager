'use strict'

const { promisify } = require('util')
const extract = require('extract-zip')

const unzip = promisify(extract)

module.exports = async function extractElectronZip (zipPath, targetDir) {
  return unzip(zipPath, { dir: targetDir })
}
