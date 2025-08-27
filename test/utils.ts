import path from 'node:path';
import os from 'node:os';
import plist, { PlistObject } from 'plist';
import fs from 'fs-extra';
import { it as originalIt } from 'vitest';
import type { ComboOptions, Options } from '../src/types';
import { isPlatformMac, sanitizeAppName } from '../src/common';
import config from './config.json';

export function generateResourcesPath(
  opts: Pick<ComboOptions, 'name' | 'platform'>,
) {
  if (isPlatformMac(opts.platform)) {
    return path.join(`${opts.name}.app`, 'Contents', 'Resources');
  }
  return 'resources';
}

export function generateNamePath(
  opts: Pick<ComboOptions, 'name' | 'platform'>,
) {
  if (isPlatformMac(opts.platform)) {
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

interface ItContext {
  baseOpts: Options;
}

/**
 * Extends Vitest's `it` function with additional context adding
 */
export const it = originalIt.extend<ItContext>({
  /* eslint-disable-next-line no-empty-pattern */
  baseOpts: async ({}, use) => {
    const workDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-workdir-'),
    );
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-tmpdir-'),
    );

    const opts: Options = {
      name: 'packagerTest',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      electronVersion: config.version,
      out: workDir,
      tmpdir: tmpDir,
    };
    await use(opts);

    await fs.rm(workDir, { recursive: true, force: true });
    await fs.rm(tmpDir, { recursive: true, force: true });
  },
});
