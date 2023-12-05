import { debug, subOptionWarning } from './common';
import { downloadArtifact, ElectronPlatformArtifactDetailsWithDefaults } from '@electron/get';
import semver from 'semver';
import { createPlatformArchPairs } from './targets';
import { DownloadOptions, IgnoreFunc, Options, SupportedArch, SupportedPlatform } from './types';

export function createDownloadOpts(opts: Options, platform: SupportedPlatform, arch: SupportedArch): DownloadOptions {
  const downloadOpts = { ...opts.download };

  subOptionWarning(downloadOpts, 'download', 'platform', platform, opts.quiet);
  subOptionWarning(downloadOpts, 'download', 'arch', arch, opts.quiet);
  subOptionWarning(downloadOpts, 'download', 'version', opts.electronVersion, opts.quiet);
  subOptionWarning(downloadOpts, 'download', 'artifactName', 'electron', opts.quiet);

  return downloadOpts as DownloadOptions;
}

export function createDownloadCombos(opts: Options, selectedPlatforms: SupportedPlatform[],
  selectedArchs: SupportedArch[], ignoreFunc?: IgnoreFunc) {
  const platformArchPairs = createPlatformArchPairs(opts, selectedPlatforms, selectedArchs, ignoreFunc);

  return platformArchPairs.map(([platform, arch]) => {
    return createDownloadOpts(opts, platform, arch);
  });
}

export async function downloadElectronZip(downloadOpts: DownloadOptions) {
  // armv7l builds have only been backfilled for Electron >= 1.0.0.
  // See: https://github.com/electron/electron/pull/6986
  /* istanbul ignore if */
  if (downloadOpts.arch === 'armv7l' && semver.lt(downloadOpts.version, '1.0.0')) {
    downloadOpts.arch = 'arm';
  }
  debug(`Downloading Electron with options ${JSON.stringify(downloadOpts)}`);
  return downloadArtifact(downloadOpts as ElectronPlatformArtifactDetailsWithDefaults);
}
