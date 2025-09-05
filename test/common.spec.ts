import {
  info,
  warning,
  sanitizeAppName,
  generateFinalBasename,
  validateElectronApp,
  createAsarOpts,
} from '../src/common.js';
import { createDownloadOpts } from '../src/download.js';

import { describe, it, expect, vi } from 'vitest';
import { ComboOptions, Options } from '../src/types.js';
import path from 'node:path';

describe('logger', () => {
  it('does not print messages with quiet: true', () => {
    vi.spyOn(console, 'warn');
    vi.spyOn(console, 'info');
    warning('warning', true);
    info('info', true);
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });
});

describe('createDownloadOpts', () => {
  it('does not overwrite arch/platform/version/artifactName from opts override function parameters', () => {
    const opts = {
      download: {
        arch: 'ia32',
        platform: 'win32',
        version: '0.30.0',
        artifactName: 'ffmpeg',
      },
      electronVersion: '0.36.0',
      quiet: true,
    } as unknown as Options;

    const downloadOpts = createDownloadOpts(opts, 'linux', 'x64');
    expect(downloadOpts).toEqual({
      arch: 'x64',
      platform: 'linux',
      version: '0.36.0',
      artifactName: 'electron',
    });
  });
});

describe('sanitizeAppName', () => {
  it('sanitizes app names for use in file/directory names', () => {
    expect(sanitizeAppName('@username/package')).toBe('@username-package');
  });
});

describe('generateFileBasename', () => {
  it('sanitizes app names for use in the outDir name', () => {
    expect(
      generateFinalBasename({
        arch: 'x64',
        name: '@username/package-name',
        platform: 'linux',
      }),
    ).toBe('@username-package-name-linux-x64');
  });
});

describe('validateElectronApp', () => {
  it('validates electron app with main field in package.json', async () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'validate-success-with-main',
    );

    await expect(
      validateElectronApp('original-dir', fixture),
    ).resolves.toBeUndefined();
  });

  it('validates electron app without main field in package.json', async () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'validate-success-without-main',
    );

    await expect(
      validateElectronApp('original-dir', fixture),
    ).resolves.toBeUndefined();
  });

  it('fails on an Electron app without package.json', async () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'validate-failure-without-package-json',
    );

    await expect(validateElectronApp('original-dir', fixture)).rejects.toThrow(
      `Application manifest was not found. Make sure "${path.join('original-dir', 'package.json')}" exists and does not get ignored by your ignore option`,
    );
  });

  it('fails on an Electron app with a package.json with a main field missing main entry point', async () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'validate-failure-without-main-or-index',
    );

    await expect(validateElectronApp('original-dir', fixture)).rejects.toThrow(
      `The main entry point to your app was not found. Make sure "${path.join('original-dir', 'index.js')}" exists and does not get ignored by your ignore option`,
    );
  });

  it('fails on an Electron app with a package.json without a main field missing main entry point', async () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'validate-failure-with-main-without-entry-point',
    );

    await expect(validateElectronApp('original-dir', fixture)).rejects.toThrow(
      `The main entry point to your app was not found. Make sure "${path.join('original-dir', 'main.js')}" exists and does not get ignored by your ignore option`,
    );
  });
});

describe('createAsarOpts', () => {
  it('returns false if asar is not set', () => {
    expect(createAsarOpts({} as ComboOptions)).toBe(false);
  });
  it('returns false if asar is false', () => {
    expect(createAsarOpts({ asar: false } as ComboOptions)).toBe(false);
  });

  it('sets asar options to {} if true', () => {
    expect(createAsarOpts({ asar: true } as ComboOptions)).toEqual({});
  });

  it('sets asar options to the value if it is an object', () => {
    expect(createAsarOpts({ asar: { dot: true } } as ComboOptions)).toEqual({
      dot: true,
    });
  });

  it('returns false if asar is not an object or a boolean', () => {
    expect(createAsarOpts({ asar: 'test' } as unknown as ComboOptions)).toBe(
      false,
    );
  });
});
