import filenamify from 'filenamify';
import fs from 'fs-extra';
import metadata from '../package.json';
import os from 'os';
import path from 'path';
import createDebug from 'debug';

export const debug = createDebug('electron-packager');

export function sanitizeAppName(name) {
  return filenamify(name, { replacement: '-' });
}

export function generateFinalBasename(opts) {
  return `${sanitizeAppName(opts.name)}-${opts.platform}-${opts.arch}`;
}

export function generateFinalPath(opts) {
  return path.join(opts.out || process.cwd(), generateFinalBasename(opts));
}

export function info(message, quiet) {
  if (!quiet) {
    console.info(message);
  }
}

export function warning(message, quiet) {
  if (!quiet) {
    console.warn(`WARNING: ${message}`);
  }
}

export function subOptionWarning(properties, optionName, parameter, value, quiet) {
  if (Object.prototype.hasOwnProperty.call(properties, parameter)) {
    warning(`${optionName}.${parameter} will be inferred from the main options`, quiet);
  }
  properties[parameter] = value;
}

export function createAsarOpts(opts) {
  let asarOptions;
  if (opts.asar === true) {
    asarOptions = {};
  } else if (typeof opts.asar === 'object') {
    asarOptions = opts.asar;
  } else if (opts.asar === false || opts.asar === undefined) {
    return false;
  } else {
    warning(`asar parameter set to an invalid value (${opts.asar}), ignoring and disabling asar`, opts.quiet);
    return false;
  }

  return asarOptions;
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [value];
}

export function isPlatformMac(platform) {
  return platform === 'darwin' || platform === 'mas';
}

export function deprecatedParameter(properties, oldName, newName, newCLIName, quiet) {
  if (Object.prototype.hasOwnProperty.call(properties, oldName)) {
    warning(`The ${oldName} parameter is deprecated, use ${newName} (or --${newCLIName} in the CLI) instead`, quiet);
    if (!Object.prototype.hasOwnProperty.call(properties, newName)) {
      properties[newName] = properties[oldName];
    }
    delete properties[oldName];
  }
}

export function baseTempDir(opts) {
  return path.join(opts.tmpdir || os.tmpdir(), 'electron-packager');
}

/**
   * Convert slashes to UNIX-format separators.
   */
export function normalizePath(pathToNormalize) {
  return pathToNormalize.replace(/\\/g, '/');
}

/**
   * Validates that the application directory contains a package.json file, and that there exists an
   * appropriate main entry point file, per the rules of the "main" field in package.json.
   *
   * See: https://docs.npmjs.com/cli/v6/configuring-npm/package-json#main
   *
   * @param appDir - the directory specified by the user
   * @param bundledAppDir - the directory where the appDir is copied to in the bundled Electron app
   */
export async function validateElectronApp(appDir, bundledAppDir) {
  debug('Validating bundled Electron app');
  debug('Checking for a package.json file');

  const bundledPackageJSONPath = path.join(bundledAppDir, 'package.json');
  if (!(await fs.pathExists(bundledPackageJSONPath))) {
    const originalPackageJSONPath = path.join(appDir, 'package.json');
    throw new Error(`Application manifest was not found. Make sure "${originalPackageJSONPath}" exists and does not get ignored by your ignore option`);
  }

  debug('Checking for the main entry point file');
  const packageJSON = await fs.readJson(bundledPackageJSONPath);
  const mainScriptBasename = packageJSON.main || 'index.js';
  const mainScript = path.resolve(bundledAppDir, mainScriptBasename);
  if (!(await fs.pathExists(mainScript))) {
    const originalMainScript = path.join(appDir, mainScriptBasename);
    throw new Error(`The main entry point to your app was not found. Make sure "${originalMainScript}" exists and does not get ignored by your ignore option`);
  }

  debug('Validation complete');
}

export function hostInfo() {
  return `Electron Packager ${metadata.version}\n` +
      `Node ${process.version}\n` +
      `Host Operating system: ${process.platform} ${os.release()} (${process.arch})`;
}