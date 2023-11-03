import { debug, subOptionWarning } from './common';
import { downloadArtifact } from '@electron/get';
import semver from 'semver';
import { createPlatformArchPairs } from './targets';

export function createDownloadOpts(opts, platform, arch) {
  const downloadOpts = { ...opts.download };

  subOptionWarning(downloadOpts, 'download', 'platform', platform, opts.quiet);
  subOptionWarning(downloadOpts, 'download', 'arch', arch, opts.quiet);
  subOptionWarning(downloadOpts, 'download', 'version', opts.electronVersion, opts.quiet);
  subOptionWarning(downloadOpts, 'download', 'artifactName', 'electron', opts.quiet);

  return downloadOpts;
}

export function createDownloadCombos(opts, selectedPlatforms, selectedArchs, ignoreFunc) {
  return createPlatformArchPairs(opts, selectedPlatforms, selectedArchs, ignoreFunc).map(([platform, arch]) => {
    return createDownloadOpts(opts, platform, arch);
  });
}

export async function downloadElectronZip(downloadOpts) {
  // armv7l builds have only been backfilled for Electron >= 1.0.0.
  // See: https://github.com/electron/electron/pull/6986
  /* istanbul ignore if */
  if (downloadOpts.arch === 'armv7l' && semver.lt(downloadOpts.version, '1.0.0')) {
    downloadOpts.arch = 'arm';
  }
  debug(`Downloading Electron with options ${JSON.stringify(downloadOpts)}`);
  return downloadArtifact(downloadOpts);
}
