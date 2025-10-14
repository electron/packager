import filenamify from 'filenamify';
import fs from 'graceful-fs';
import os from 'node:os';
import path from 'node:path';
import createDebug from 'debug';
import { ProcessedOptionsWithSinglePlatformArch, Options } from './types.js';
import { CreateOptions as AsarOptions } from '@electron/asar';

export const debug = createDebug('electron-packager');

export function sanitizeAppName(name: string) {
  return filenamify(name, { replacement: '-' });
}

export function generateFinalBasename(
  opts: Pick<
    ProcessedOptionsWithSinglePlatformArch,
    'arch' | 'name' | 'platform'
  >,
) {
  return `${sanitizeAppName(opts.name)}-${opts.platform}-${opts.arch}`;
}

export function generateFinalPath(
  opts: ProcessedOptionsWithSinglePlatformArch,
) {
  return path.join(opts.out || process.cwd(), generateFinalBasename(opts));
}

export function info(message: unknown, quiet?: boolean) {
  if (!quiet) {
    console.info(message);
  }
}

export function warning(message: unknown, quiet?: boolean) {
  if (!quiet) {
    console.warn(`WARNING: ${message}`);
  }
}

export function subOptionWarning(
  properties: Record<string, unknown>,
  optionName: string,
  parameter: string,
  value: unknown,
  quiet?: boolean,
) {
  if (Object.prototype.hasOwnProperty.call(properties, parameter)) {
    warning(
      `${optionName}.${parameter} will be inferred from the main options`,
      quiet,
    );
  }
  properties[parameter] = value;
}

/**
 * Creates the final `@electron/asar` options for final packaging function based on user options.
 * @param opts The processed options for the packager.
 * @returns The ASAR options or false if ASAR is disabled.
 */
export function createAsarOpts(
  opts: ProcessedOptionsWithSinglePlatformArch,
): false | AsarOptions {
  let asarOptions: AsarOptions;
  if (opts.asar === true || opts.asar === undefined) {
    asarOptions = {
      unpack: '**/{.**,**}/**/*.node',
    };
  } else if (typeof opts.asar === 'object') {
    asarOptions = opts.asar;
  } else if (opts.asar === false) {
    return false;
  } else {
    warning(
      `asar parameter set to an invalid value (${opts.asar}), ignoring and disabling asar`,
      opts.quiet,
    );
    return false;
  }

  return asarOptions;
}

export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function isPlatformMac(
  platform: ProcessedOptionsWithSinglePlatformArch['platform'],
) {
  return platform === 'darwin' || platform === 'mas';
}

/**
 * Gets the tmpdir for packaging. Note that if `opts.tmpdir` is false,
 * we're still returning a path.
 */
export function baseTempDir(opts: Options) {
  return path.join(
    typeof opts.tmpdir === 'string' ? opts.tmpdir : os.tmpdir(),
    'electron-packager',
  );
}

/**
 * Convert slashes to UNIX-format separators.
 */
export function normalizePath(pathToNormalize: string) {
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
export async function validateElectronApp(
  appDir: string,
  bundledAppDir: string,
) {
  debug('Validating bundled Electron app');
  debug('Checking for a package.json file');

  const bundledPackageJSONPath = path.join(bundledAppDir, 'package.json');
  if (!fs.existsSync(bundledPackageJSONPath)) {
    const originalPackageJSONPath = path.join(appDir, 'package.json');
    throw new Error(
      `Application manifest was not found. Make sure "${originalPackageJSONPath}" exists and does not get ignored by your ignore option`,
    );
  }

  debug('Checking for the main entry point file');
  const packageJSON = JSON.parse(
    await fs.promises.readFile(bundledPackageJSONPath, 'utf8'),
  );
  const mainScriptBasename = packageJSON.main || 'index.js';
  const mainScript = path.resolve(bundledAppDir, mainScriptBasename);
  if (!fs.existsSync(mainScript)) {
    const originalMainScript = path.join(appDir, mainScriptBasename);
    throw new Error(
      `The main entry point to your app was not found. Make sure "${originalMainScript}" exists and does not get ignored by your ignore option`,
    );
  }

  debug('Validation complete');
}

export async function hostInfo() {
  const packageJSONPath = path.resolve(import.meta.dirname, '../package.json');
  const metadata = JSON.parse(
    await fs.promises.readFile(packageJSONPath, 'utf8'),
  );

  return (
    `Electron Packager ${metadata.version}\n` +
    `Node ${process.version}\n` +
    `Host Operating system: ${process.platform} ${os.release()} (${process.arch})`
  );
}
