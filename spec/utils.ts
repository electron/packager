import path from 'node:path';
import plist, { PlistObject } from 'plist';
import fs from 'fs-extra';
import type { Options } from '../src/types';

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
  const appName = `${path.basename(basePath).split('-')[0]}.app`;
  const plistPath = path.join(basePath, appName, 'Contents', 'Info.plist');
  return plist.parse(fs.readFileSync(plistPath, 'utf8')) as PlistObject;
}
