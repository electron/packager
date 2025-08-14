import path from 'node:path';
import plist, { PlistObject } from 'plist';
import fs from 'fs-extra';
import type { Options } from '../src/types';
import { sanitizeAppName } from '../src/common';

export function generateResourcesPath(
  opts: Pick<Options, 'name' | 'platform'>,
) {
  if (opts.platform === 'darwin') {
    return path.join(`${opts.name}.app`, 'Contents', 'Resources');
  } else {
    return 'resources';
  }
}

export function generateNamePath(opts: Pick<Options, 'name' | 'platform'>) {
  if (opts.platform === 'darwin') {
    return path.join(
      `${opts.name}.app`,
      'Contents',
      'Frameworks',
      `${opts.name} Helper.app`,
    );
  }

  return opts.name + (opts.platform === 'win32' ? '.exe' : '');
}

export function parseInfoPlist(basePath: string): PlistObject {
  const parts = path.basename(basePath).split('-');
  const appName = parts.slice(0, parts.length - 2).join('-');
  const sanitizedAppName = sanitizeAppName(appName);
  const plistPath = path.join(
    basePath,
    `${sanitizedAppName}.app`,
    'Contents',
    'Info.plist',
  );
  return plist.parse(fs.readFileSync(plistPath, 'utf8')) as PlistObject;
}

export function parseHelperInfoPlist(
  basePath: string,
  helperType?: 'GPU' | 'Renderer' | 'Plugin',
): PlistObject {
  const parts = path.basename(basePath).split('-');
  const appName = parts.slice(0, parts.length - 2).join('-');
  const sanitizedAppName = sanitizeAppName(appName);
  const plistPath = path.join(
    basePath,
    `${sanitizedAppName}.app`,
    'Contents',
    'Frameworks',
    helperType
      ? `${sanitizedAppName} Helper (${helperType}).app`
      : `${sanitizedAppName} Helper.app`,
    'Contents',
    'Info.plist',
  );
  return plist.parse(fs.readFileSync(plistPath, 'utf8')) as PlistObject;
}
