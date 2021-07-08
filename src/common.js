'use strict'

const debug = require('debug')('electron-packager')
const filenamify = require('filenamify')
const fs = require('fs-extra')
const metadata = require('../package.json')
const os = require('os')
const path = require('path')

function sanitizeAppName (name) {
  return filenamify(name, { replacement: '-' })
}

function generateFinalBasename (opts) {
  return `${sanitizeAppName(opts.name)}-${opts.platform}-${opts.arch}`
}

function generateFinalPath (opts) {
  return path.join(opts.out || process.cwd(), generateFinalBasename(opts))
}

function info (message, quiet) {
  if (!quiet) {
    console.error(message)
  }
}

function warning (message, quiet) {
  if (!quiet) {
    console.warn(`WARNING: ${message}`)
  }
}

function subOptionWarning (properties, optionName, parameter, value, quiet) {
  if (Object.prototype.hasOwnProperty.call(properties, parameter)) {
    warning(`${optionName}.${parameter} will be inferred from the main options`, quiet)
  }
  properties[parameter] = value
}

function createAsarOpts (opts) {
  let asarOptions
  if (opts.asar === true) {
    asarOptions = {}
  } else if (typeof opts.asar === 'object') {
    asarOptions = opts.asar
  } else if (opts.asar === false || opts.asar === undefined) {
    return false
  } else {
    warning(`asar parameter set to an invalid value (${opts.asar}), ignoring and disabling asar`)
    return false
  }

  return asarOptions
}

module.exports = {
  ensureArray: function ensureArray (value) {
    return Array.isArray(value) ? value : [value]
  },
  isPlatformMac: function isPlatformMac (platform) {
    return platform === 'darwin' || platform === 'mas'
  },

  createAsarOpts: createAsarOpts,

  deprecatedParameter: function deprecatedParameter (properties, oldName, newName, newCLIName) {
    if (Object.prototype.hasOwnProperty.call(properties, oldName)) {
      warning(`The ${oldName} parameter is deprecated, use ${newName} (or --${newCLIName} in the CLI) instead`)
      if (!Object.prototype.hasOwnProperty.call(properties, newName)) {
        properties[newName] = properties[oldName]
      }
      delete properties[oldName]
    }
  },
  subOptionWarning: subOptionWarning,

  baseTempDir: function baseTempDir (opts) {
    return path.join(opts.tmpdir || os.tmpdir(), 'electron-packager')
  },
  generateFinalBasename: generateFinalBasename,
  generateFinalPath: generateFinalPath,
  sanitizeAppName,
  /**
   * Convert slashes to UNIX-format separators.
   */
  normalizePath: function normalizePath (pathToNormalize) {
    return pathToNormalize.replace(/\\/g, '/')
  },
  /**
   * Validates that the application directory contains a package.json file, and that there exists an
   * appropriate main entry point file, per the rules of the "main" field in package.json.
   *
   * See: https://docs.npmjs.com/cli/v6/configuring-npm/package-json#main
   *
   * @param appDir - the directory specified by the user
   * @param bundledAppDir - the directory where the appDir is copied to in the bundled Electron app
   */
  validateElectronApp: async function validateElectronApp (appDir, bundledAppDir) {
    debug('Validating bundled Electron app')
    debug('Checking for a package.json file')

    const bundledPackageJSONPath = path.join(bundledAppDir, 'package.json')
    if (!(await fs.pathExists(bundledPackageJSONPath))) {
      const originalPackageJSONPath = path.join(appDir, 'package.json')
      throw new Error(`Application manifest was not found. Make sure "${originalPackageJSONPath}" exists and does not get ignored by your ignore option`)
    }

    debug('Checking for the main entry point file')
    const packageJSON = await fs.readJson(bundledPackageJSONPath)
    const mainScriptBasename = packageJSON.main || 'index.js'
    const mainScript = path.resolve(bundledAppDir, mainScriptBasename)
    if (!(await fs.pathExists(mainScript))) {
      const originalMainScript = path.join(appDir, mainScriptBasename)
      throw new Error(`The main entry point to your app was not found. Make sure "${originalMainScript}" exists and does not get ignored by your ignore option`)
    }

    debug('Validation complete')
  },

  hostInfo: function hostInfo () {
    return `Electron Packager ${metadata.version}\n` +
      `Node ${process.version}\n` +
      `Host Operating system: ${process.platform} ${os.release()} (${process.arch})`
  },
  info: info,
  warning: warning
}
