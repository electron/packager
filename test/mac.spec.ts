import {
  createNotarizeOpts,
  createSignOpts,
  filterCFBundleIdentifier,
} from '../src/mac';
import { describe, it, expect } from 'vitest';

describe('createNotarizeOpts', () => {
  it('does not allow appPath to be overwritten', () => {
    const args = {
      appleId: '1',
      appleIdPassword: '2',
      teamId: '333',
      appPath: 'no',
    };
    const notarizeOpts = createNotarizeOpts(args, 'original', 'appPath', true);
    expect(notarizeOpts.appPath).toBe('appPath');
  });
});

describe('createSignOpts', () => {
  it('uses default args', () => {
    const args = true;
    const signOpts = createSignOpts(args, 'darwin', 'out', 'version');
    expect(signOpts).toEqual({
      identity: null,
      app: 'out',
      platform: 'darwin',
      version: 'version',
      continueOnError: true,
    });
  });

  it('passes optionsForFile to @electron/osx-sign', () => {
    const optionsForFile = () => ({ entitlements: 'path-to-entitlements' });
    const args = { optionsForFile };
    const signOpts = createSignOpts(args, 'darwin', 'out', 'version');
    expect(signOpts).toEqual({
      app: 'out',
      platform: 'darwin',
      version: 'version',
      optionsForFile,
      continueOnError: true,
    });
  });

  it('does not overwrite the app, platform, or binaries parameters', () => {
    const args = {
      app: 'some-other-path',
      platform: 'mas',
      binaries: ['binary1', 'binary2'],
    };
    // @ts-expect-error - we disallow these invalid parameters through types anyways
    const signOpts = createSignOpts(args, 'darwin', 'out', 'version');
    expect(signOpts).toEqual({
      app: 'out',
      platform: 'darwin',
      version: 'version',
      continueOnError: true,
    });
  });

  it('passes in continueOnError=false', () => {
    const args: Partial<ReturnType<typeof createSignOpts>> = { continueOnError: false };
    const signOpts = createSignOpts(args, 'darwin', 'out', 'version');
    expect(signOpts.continueOnError).toBe(false);
  });
});

describe('filterCFBundleIdentifier', () => {
  it('replaces spaces with hyphens', () => {
    expect(filterCFBundleIdentifier('com.electron.beep boop')).toBe(
      'com.electron.beep-boop',
    );
  });
  it('removes all other special characters', () => {
    expect(filterCFBundleIdentifier('com.electron.téæ?&*')).toBe(
      'com.electron.t',
    );
  });
});
