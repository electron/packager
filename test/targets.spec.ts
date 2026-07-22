import {
  allOfficialArchsForPlatformAndVersion,
  createPlatformArchPairs,
  supported,
  validateListFromOptions,
} from '../src/targets.js';

import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { Options, OfficialPlatform, OfficialArch } from '../src/types.js';
import config from './config.json' with { type: 'json' };

describe('allOfficialArchsForPlatformAndVersion', () => {
  it('returns undefined for unknown platforms', () => {
    const result = allOfficialArchsForPlatformAndVersion(
      // @ts-expect-error - we're faking an invalid platform value to see the behaviour on runtime
      'unknown',
      '1.0.0',
    );
    expect(result).toBe(undefined);
  });

  it('returns the correct arches for a known platform', () => {
    const result = allOfficialArchsForPlatformAndVersion('darwin', config.version);
    expect(result.sort()).toEqual(['arm64', 'x64', 'universal'].sort());
  });

  it('supports linux/arm64 for the correct versions', () => {
    const result = allOfficialArchsForPlatformAndVersion('linux', '1.8.0');
    expect(result).toContain('arm64');
    const result2 = allOfficialArchsForPlatformAndVersion('linux', '1.7.0');
    expect(result2).not.toContain('arm64');
  });

  it('returns linux/mips64el when the correct version is specified', () => {
    const result = allOfficialArchsForPlatformAndVersion('linux', '1.8.2');
    expect(result).toContain('mips64el');
    const result2 = allOfficialArchsForPlatformAndVersion('linux', '1.8.2-beta.4');
    expect(result2).not.toContain('mips64el');
  });

  it('returns win32/arm64 when the correct version is specified', () => {
    const result = allOfficialArchsForPlatformAndVersion('win32', '6.0.8');
    expect(result).toContain('arm64');
    const result2 = allOfficialArchsForPlatformAndVersion('win32', '6.0.7');
    expect(result2).not.toContain('arm64');
  });

  it('returns darwin/arm64 when the correct version is specified', () => {
    const result = allOfficialArchsForPlatformAndVersion('darwin', '11.0.0');
    expect(result).toContain('arm64');
    const result2 = allOfficialArchsForPlatformAndVersion('darwin', '10.0.0');
    expect(result2).not.toContain('arm64');
  });

  it('returns mas/arm64 when the correct version is specified', () => {
    const result = allOfficialArchsForPlatformAndVersion('mas', '11.0.0');
    expect(result).toContain('arm64');
    const result2 = allOfficialArchsForPlatformAndVersion('mas', '10.0.0');
    expect(result2).not.toContain('arm64');
  });

  it('supports win32/ia32 for the correct versions', () => {
    const result = allOfficialArchsForPlatformAndVersion('win32', '43.0.0');
    expect(result).toContain('ia32');
    const result2 = allOfficialArchsForPlatformAndVersion('win32', '44.0.0-alpha.3');
    expect(result2).toContain('ia32');
    const result3 = allOfficialArchsForPlatformAndVersion('win32', '44.0.0-alpha.4');
    expect(result3).not.toContain('ia32');
    const result4 = allOfficialArchsForPlatformAndVersion('win32', '44.0.0');
    expect(result4).not.toContain('ia32');
    const result5 = allOfficialArchsForPlatformAndVersion('win32', '45.0.0-nightly.20260714');
    expect(result5).not.toContain('ia32');
  });

  it('supports linux/armv7l for the correct versions', () => {
    const result = allOfficialArchsForPlatformAndVersion('linux', '43.0.0');
    expect(result).toContain('armv7l');
    const result2 = allOfficialArchsForPlatformAndVersion('linux', '44.0.0-alpha.3');
    expect(result2).toContain('armv7l');
    const result3 = allOfficialArchsForPlatformAndVersion('linux', '44.0.0-alpha.4');
    expect(result3).not.toContain('armv7l');
    const result4 = allOfficialArchsForPlatformAndVersion('linux', '44.0.0');
    expect(result4).not.toContain('armv7l');
    const result5 = allOfficialArchsForPlatformAndVersion('linux', '45.0.0-nightly.20260714');
    expect(result5).not.toContain('armv7l');
  });
});

describe('validateListFromOptions', () => {
  it('does not take non-Array/String values', () => {
    // @ts-expect-error - we're creating fake properties for this test
    supported.digits = new Set(['64', '65']);
    // @ts-expect-error - we're creating fake properties for this test
    const result = validateListFromOptions({ digits: 64 }, 'digits');
    expect(result).toBeInstanceOf(Error);
  });

  it('works for armv7l host and target arch', () => {
    vi.stubGlobal('process', {
      arch: 'arm',
      config: {
        variables: { arm_version: '7' },
      },
    });

    expect(validateListFromOptions({} as unknown as Options, 'arch')).toEqual(['armv7l']);

    vi.unstubAllGlobals();
  });
});

describe('createPlatformArchPairs', () => {
  it.each([
    {
      testCase: 'all available official targets',
      extraOpts: { all: true },
      expectedLength: process.platform === 'darwin' ? 12 : 10, // no universal on other platforms
    },
    {
      testCase: 'available targets in a version without arm64 or mips64el support',
      extraOpts: { all: true, electronVersion: '1.4.13' },
      expectedLength: 7,
    },
    {
      testCase: 'all platforms with a single arch',
      extraOpts: { platform: 'all', arch: 'ia32', electronVersion: '1.4.13' },
      expectedLength: 2,
    },
    {
      testCase: 'all arches with a single platform',
      extraOpts: { platform: 'linux', arch: 'all' },
      expectedLength: 3,
    },
    {
      testCase: 'all win32 arches in a version without ia32 support',
      extraOpts: { platform: 'win32', arch: 'all', electronVersion: '44.0.0-alpha.4' },
      expectedLength: 2,
    },
    {
      testCase: 'all linux arches in a version without ia32, armv7l, or mips64el support',
      extraOpts: { platform: 'linux', arch: 'all', electronVersion: '45.0.0-nightly.20260714' },
      expectedLength: 2,
    },
    {
      testCase: 'win32/ia32 in the last version that supports it',
      extraOpts: { platform: 'win32', arch: 'ia32', electronVersion: '44.0.0-alpha.3' },
      expectedLength: 1,
    },
    {
      testCase: 'win32/ia32 in a version that no longer supports it',
      extraOpts: { platform: 'win32', arch: 'ia32', electronVersion: '44.0.0-alpha.4' },
      expectedLength: 0,
    },
    {
      testCase: 'linux/armv7l in the last version that supports it',
      extraOpts: { platform: 'linux', arch: 'armv7l', electronVersion: '44.0.0-alpha.3' },
      expectedLength: 1,
    },
    {
      testCase: 'linux/armv7l in a version that no longer supports it',
      extraOpts: { platform: 'linux', arch: 'armv7l', electronVersion: '45.0.0-nightly.20260714' },
      expectedLength: 0,
    },
    {
      testCase: 'platform/arch combinations (arrays)',
      extraOpts: { platform: ['darwin', 'win32'], arch: ['arm64', 'x64'] },
      expectedLength: 4,
    },
    {
      testCase: 'platform/arch combinations (strings)',
      extraOpts: { platform: 'darwin,win32', arch: 'arm64,x64' },
      expectedLength: 4,
    },
    {
      testCase: 'platform/arch combinations (strings with spaces)',
      extraOpts: { platform: 'darwin, win32', arch: 'arm64, x64' },
      expectedLength: 4,
    },
    {
      testCase: 'invalid platform/arch combination',
      extraOpts: { platform: 'darwin', arch: 'ia32' },
      expectedLength: 0,
    },
    {
      testCase: 'invalid platform/arch combination',
      extraOpts: { platform: 'darwin', arch: 'ia32' },
      expectedLength: 0,
    },
    {
      testCase: 'unofficial arch',
      extraOpts: {
        platform: 'linux',
        arch: 'z80',
        download: { mirrorOptions: { mirror: 'mirror' } },
      },
      expectedLength: 1,
    },
    {
      testCase: 'unofficial platform',
      extraOpts: {
        platform: 'android',
        arch: 'ia32',
        download: { mirrorOptions: { mirror: 'mirror' } },
      },
      expectedLength: 1,
    },
  ])('builds for $testCase', ({ extraOpts, expectedLength }) => {
    const opts = {
      name: 'test',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      electronVersion: config.version,
      ...extraOpts,
    } as Options;

    const platforms = validateListFromOptions(opts, 'platform') as OfficialPlatform[];
    const archs = validateListFromOptions(opts, 'arch') as OfficialArch[];
    const result = createPlatformArchPairs(opts, platforms, archs);

    expect(result.length).toEqual(expectedLength);
  });
});
