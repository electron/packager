import { warning } from './common';
import { getHostArch } from '@electron/get';
import semver from 'semver';
import { IgnoreFunc, OfficialPlatform, Options, SupportedArch, SupportedPlatform } from './types';

export const officialArchs = ['ia32', 'x64', 'armv7l', 'arm64', 'mips64el', 'universal'];

export const officialPlatforms = ['darwin', 'linux', 'mas', 'win32'];

export const officialPlatformArchCombos = {
  darwin: ['x64', 'arm64', 'universal'],
  linux: ['ia32', 'x64', 'armv7l', 'arm64', 'mips64el'],
  mas: ['x64', 'arm64', 'universal'],
  win32: ['ia32', 'x64', 'arm64'],
} as Record<SupportedPlatform, SupportedArch[]>;

const buildVersions = {
  darwin: {
    arm64: '>= 11.0.0-beta.1',
    universal: '>= 11.0.0-beta.1',
  },
  linux: {
    arm64: '>= 1.8.0',
    ia32: '<19.0.0-beta.1',
    mips64el: '^1.8.2-beta.5',
  },
  mas: {
    arm64: '>= 11.0.0-beta.1',
    universal: '>= 11.0.0-beta.1',
  },
  win32: {
    arm64: '>= 6.0.8',
  },
} as Record<SupportedPlatform, Record<SupportedArch, string>>;

// Maps to module filename for each platform (lazy-required if used)
export const osModules: Record<OfficialPlatform, string> = {
  darwin: './mac',
  linux: './linux',
  mas: './mac', // map to darwin
  win32: './win32',
};

export const supported = {
  arch: new Set(officialArchs),
  platform: new Set(officialPlatforms),
};

export function createPlatformArchPairs(opts: Options, selectedPlatforms: SupportedPlatform[],
  selectedArchs: SupportedArch[],
  ignoreFunc?: IgnoreFunc) {
  const combinations: Array<[SupportedPlatform, SupportedArch]> = [];

  for (const arch of selectedArchs) {
    for (const platform of selectedPlatforms) {
      if (usingOfficialElectronPackages(opts)) {
        if (!validOfficialPlatformArch(platform, arch)) {
          warnIfAllNotSpecified(opts, `The platform/arch combination ${platform}/${arch} is not currently supported by Electron Packager`);
          continue;
        } else if (buildVersions[platform] && buildVersions[platform][arch]) {
          const buildVersion = buildVersions[platform][arch];
          if (buildVersion && !officialBuildExists(opts, buildVersion)) {
            warnIfAllNotSpecified(opts, `Official ${platform}/${arch} support only exists in Electron ${buildVersion}`);
            continue;
          }
        }

        if (typeof ignoreFunc === 'function' && ignoreFunc(platform, arch)) {
          continue;
        }
      }
      combinations.push([platform, arch]);
    }
  }

  return combinations;
}

function unsupportedListOption(name: keyof typeof supported, value: unknown, supportedValues: Set<string>) {
  return new Error(`Unsupported ${name}=${value} (${typeof value}); must be a string matching: ${Array.from(supportedValues.values())
    .join(', ')}`);
}

function usingOfficialElectronPackages(opts: Options) {
  return !opts.download || !Object.prototype.hasOwnProperty.call(opts.download, 'mirrorOptions');
}

function validOfficialPlatformArch(platform: SupportedPlatform, arch: SupportedArch) {
  return officialPlatformArchCombos[platform] && officialPlatformArchCombos[platform].includes(arch);
}

function officialBuildExists(opts: Pick<Options, 'electronVersion'>, buildVersion: string) {
  return semver.satisfies(opts.electronVersion!, buildVersion, { includePrerelease: true });
}

function allPlatformsOrArchsSpecified(opts: Options) {
  return opts.all || opts.arch === 'all' || opts.platform === 'all';
}

function warnIfAllNotSpecified(opts: Options, message: string) {
  if (!allPlatformsOrArchsSpecified(opts)) {
    warning(message, opts.quiet);
  }
}

export function allOfficialArchsForPlatformAndVersion(platform: SupportedPlatform,
  electronVersion: Options['electronVersion']) {
  const archs = officialPlatformArchCombos[platform];

  if (buildVersions[platform]) {
    const excludedArchs = (Object.keys(buildVersions[platform]) as SupportedArch[])
      .filter(arch => !officialBuildExists({ electronVersion: electronVersion }, buildVersions[platform][arch]));
    return archs.filter(arch => !excludedArchs.includes(arch));
  }

  return archs;
}

// Validates list of architectures or platforms.
// Returns a normalized array if successful, or throws an Error.
export function validateListFromOptions(opts: Options, name: keyof typeof supported) {
  if (opts.all) {
    return Array.from(supported[name].values());
  }

  let list = opts[name];
  if (!list) {
    if (name === 'arch') {
      list = getHostArch();
    } else {
      list = process[name];
    }
  } else if (list === 'all') {
    return Array.from(supported[name].values());
  }

  if (!Array.isArray(list)) {
    if (typeof list === 'string') {
      list = list.split(/,\s*/);
    } else {
      return unsupportedListOption(name, list, supported[name]);
    }
  }

  const officialElectronPackages = usingOfficialElectronPackages(opts);

  for (const value of list) {
    if (officialElectronPackages && !supported[name].has(value)) {
      return unsupportedListOption(name, value, supported[name]);
    }
  }

  return list;
}
