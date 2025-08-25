import { isPlatformMac } from '../../src/common';
import {
  createDownloadCombos,
  downloadElectronZip as packagerDownloadElectronZip,
} from '../../src/download';
import { downloadArtifact } from '@electron/get';
import os from 'node:os';
import path from 'node:path';
import config from '../config.json';
import { Options } from '../../src/types';
import { officialArchs, officialPlatforms } from '../../src/targets';

/**
 * Skip testing darwin/mas target on Windows since Electron Packager itself skips it
 * (see https://github.com/electron/packager/issues/71)
 */
function skipDownloadingMacZips(platform: string) {
  return isPlatformMac(platform) && process.platform === 'win32';
}

async function downloadAll(version: string) {
  console.log(`Downloading Electron v${version} before running tests...`);
  const combinations = createDownloadCombos(
    { electronVersion: config.version, all: true } as Options,
    officialPlatforms,
    officialArchs,
    skipDownloadingMacZips,
  );

  await downloadElectronChecksum(version);
  return Promise.all([
    ...combinations.map((combination) =>
      combination.arch === 'universal'
        ? null
        : downloadElectronZip(version, combination),
    ),
    downloadElectronZip('6.0.0', {
      platform: 'darwin',
      arch: 'x64',
    }),
  ]);
}

async function downloadElectronChecksum(version: string) {
  return downloadArtifact({
    isGeneric: true,
    cacheRoot: path.join(os.homedir(), '.electron'),
    version,
    artifactName: 'SHASUMS256.txt',
  });
}

async function downloadElectronZip(
  version: string,
  options: { platform: string | string[]; arch: string | string[] },
) {
  return packagerDownloadElectronZip({
    ...options,
    artifactName: 'electron',
    // @ts-expect-error - cacheRoot is not a valid option for downloadElectronZip
    cacheRoot: path.join(os.homedir(), '.electron'),
    version,
  });
}

/**
 * Download all Electron distributions before running tests to avoid timing out due to
 * network speed.
 */
async function preDownloadElectron() {
  const versions = [config.version];
  await Promise.all(versions.map(downloadAll));
}

export async function setupTestSuiteForCI() {
  try {
    await preDownloadElectron();
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.stack);
    } else {
      console.error(error);
    }

    return process.exit(1);
  }
}

preDownloadElectron();
