import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import plist, { PlistObject } from 'plist';
import { it as originalIt } from 'vitest';
import type { ProcessedOptionsWithSinglePlatformArch, Options } from '../src/types.js';
import { isPlatformMac, sanitizeAppName } from '../src/common.js';
import config from './config.json' with { type: 'json' };

export function generateResourcesPath(
  opts: Pick<ProcessedOptionsWithSinglePlatformArch, 'name' | 'platform'>,
) {
  if (isPlatformMac(opts.platform)) {
    return path.join(`${opts.name}.app`, 'Contents', 'Resources');
  }
  return 'resources';
}

export function generateNamePath(
  opts: Pick<ProcessedOptionsWithSinglePlatformArch, 'name' | 'platform'>,
) {
  if (isPlatformMac(opts.platform)) {
    return path.join(`${opts.name}.app`, 'Contents', 'Frameworks', `${opts.name} Helper.app`);
  }

  return opts.name + (opts.platform === 'win32' ? '.exe' : '');
}

export function parseInfoPlist(basePath: string): PlistObject {
  const parts = path.basename(basePath).split('-');
  const appName = parts.slice(0, parts.length - 2).join('-');
  const sanitizedAppName = sanitizeAppName(appName);
  const plistPath = path.join(basePath, `${sanitizedAppName}.app`, 'Contents', 'Info.plist');
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

/**
 * Computes the expected v1 asar integrity digest: SHA256 over sorted
 * (key, algorithm, hash) tuples, mirroring `MacApp.setIntegrityDigest`.
 */
export function computeExpectedDigest(
  integrity: Record<string, { algorithm: string; hash: string }>,
): Buffer {
  const hash = crypto.createHash('SHA256');
  for (const key of Object.keys(integrity).sort()) {
    hash.update(key);
    hash.update(integrity[key].algorithm);
    hash.update(integrity[key].hash);
  }
  return hash.digest();
}

interface ItContext {
  baseOpts: Options &
    Required<Pick<Options, 'name' | 'dir' | 'electronVersion' | 'out' | 'tmpdir'>>;
}

/**
 * Extends Vitest's `it` function with additional context adding
 */
export const it = originalIt.extend<ItContext>({
  /* eslint-disable-next-line no-empty-pattern */
  baseOpts: async ({}, use) => {
    const workDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-workdir-'),
    );
    const tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-tmpdir-'),
    );

    const opts = {
      name: 'packagerTest',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      electronVersion: config.version,
      out: workDir,
      tmpdir: tmpDir,
    };
    await use(opts);

    await fs.promises.rm(workDir, { recursive: true, force: true });
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  },
});
