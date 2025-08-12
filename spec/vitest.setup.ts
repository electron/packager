import fs from 'fs-extra';
import { expect } from 'vitest';

expect.extend({
  toBeDirectory(received) {
    const pass = fs.statSync(received).isDirectory();
    if (pass) {
      return {
        message: () => `expected ${received} not to be a directory`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a directory`,
        pass: false,
      };
    }
  },
  toBeFile(received) {
    const pass = fs.statSync(received).isFile();
    if (pass) {
      return {
        message: () => `expected ${received} not to be a file`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a file`,
        pass: false,
      };
    }
  },
});

// import { isPlatformMac } from '../src/common';
// import {
//   createDownloadCombos,
//   downloadElectronZip as packagerDownloadElectronZip,
// } from '../src/download';
// import { downloadArtifact } from '@electron/get';
// import childProcess from 'node:child_process';
// import fs from 'fs-extra';
// import os from 'node:os';
// import path from 'node:path';
// import util from 'node:util';
// import config from './config.json';

// import { officialArchs, officialPlatforms } from '../src/targets';

// const exec = util.promisify(childProcess.exec);

// function fixtureSubdir(subdir: string) {
//   return path.join(__dirname, 'fixtures', subdir);
// }

// /**
//  * Skip testing darwin/mas target on Windows since Electron Packager itself skips it
//  * (see https://github.com/electron/packager/issues/71)
//  */
// function skipDownloadingMacZips(platform: string) {
//   return isPlatformMac(platform) && process.platform === 'win32';
// }

// async function downloadAll(version: string) {
//   console.log(`Downloading Electron v${version} before running tests...`);
//   const combinations = createDownloadCombos(
//     { electronVersion: config.version, all: true } as any,
//     officialPlatforms,
//     officialArchs,
//     skipDownloadingMacZips,
//   );

//   await downloadElectronChecksum(version);
//   return Promise.all([
//     ...combinations.map((combination) =>
//       combination.arch === 'universal'
//         ? null
//         : downloadElectronZip(version, combination),
//     ),
//     downloadElectronZip('6.0.0', {
//       platform: 'darwin',
//       arch: 'x64',
//     }),
//   ]);
// }

// async function downloadElectronChecksum(version) {
//   return downloadArtifact({
//     isGeneric: true,
//     cacheRoot: path.join(os.homedir(), '.electron'),
//     version,
//     artifactName: 'SHASUMS256.txt',
//   });
// }

// async function downloadElectronZip(version, options) {
//   return packagerDownloadElectronZip({
//     ...options,
//     artifactName: 'electron',
//     cacheRoot: path.join(os.homedir(), '.electron'),
//     version,
//   });
// }

// /**
//  * Download all Electron distributions before running tests to avoid timing out due to
//  * network speed.
//  */
// async function preDownloadElectron() {
//   const versions = [config.version];
//   await Promise.all(versions.map(downloadAll));
// }

// const WORK_CWD = path.join(__dirname, 'work');

// async function ensureEmptyWorkDirExists() {
//   await fs.remove(WORK_CWD);
//   await fs.mkdirs(WORK_CWD);
// }

// module.exports = {
//   fixtureSubdir: fixtureSubdir,
//   setupTestsuite: async function setupTestsuite() {
//     try {
//       await preDownloadElectron();
//     } catch (error) {
//       console.error(error.stack || error);
//       return process.exit(1);
//     }
//     await ensureEmptyWorkDirExists();
//   },
//   WORK_CWD: WORK_CWD,
// };
