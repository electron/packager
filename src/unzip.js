'use strict'

const os = require('os')
const { promisify } = require('util')
const { warning } = require('./common')
const zip = require('cross-zip')

const unzip = promisify(zip.unzip)

/**
 * Detects Windows 7 via release number.
 *
 * This also detects Windows Server 2008 R2, but since we're using it to determine whether to check * for Powershell/.NET Framework, it's fine.
 */
function probablyWindows7 () {
  if (process.platform === 'win32') {
    const [majorVersion, minorVersion] = os.release().split('.').map(Number)
    return majorVersion === 6 && minorVersion === 1
  }

  return false
}

module.exports = async function extractElectronZip (zipPath, targetDir) {
  if (probablyWindows7()) {
    /* istanbul ignore next */
    warning('Make sure that .NET Framework 4.5 or later and Powershell 3 or later are installed, otherwise extracting the Electron zip file will hang.')
  }

  return unzip(zipPath, targetDir)
}
