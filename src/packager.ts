import path from 'node:path';
import url from 'node:url';

import {
  baseTempDir,
  debug,
  generateFinalPath,
  hostInfo,
  info,
  isPlatformMac,
} from './common.js';
import { populateIgnoredPaths } from './copy-filter.js';
import { createDownloadCombos, downloadElectronZip } from './download.js';
import fs from 'graceful-fs';
import { promisifiedGracefulFs } from './util.js';
import { getMetadataFromPackageJSON } from './infer.js';
import { runHooks } from './hooks.js';
import {
  createPlatformArchPairs,
  osModules,
  validateListFromOptions,
} from './targets.js';
import { extractElectronZip } from './unzip.js';
import { packageUniversalMac } from './universal.js';
import type {
  ProcessedOptionsWithSinglePlatformArch,
  DownloadOptions,
  OfficialArch,
  OfficialPlatform,
  Options,
  ProcessedOptions,
} from './types.js';

async function debugHostInfo() {
  debug(await hostInfo());
}

async function createProcessedOptions(
  opts: Options,
  platforms: OfficialPlatform[],
  packageJSONDir: string,
): Promise<ProcessedOptions> {
  const inferredMetadata = await getMetadataFromPackageJSON(
    platforms,
    opts,
    packageJSONDir,
  );
  const ignoreProcessing = populateIgnoredPaths(opts);

  const processedOptions = {
    ...opts,
    name: opts.name || inferredMetadata.name,
    appVersion: opts.appVersion || inferredMetadata.appVersion,
    electronVersion: opts.electronVersion || inferredMetadata.electronVersion,
    ignore: ignoreProcessing.ignore,
    originalIgnore: ignoreProcessing.originalIgnore,
    win32metadata: opts.win32metadata || inferredMetadata.win32metadata,
  };

  if (isValidProcessedOptions(processedOptions)) {
    return processedOptions;
  } else {
    throw new Error('Invalid processed options');
  }
}

function isValidProcessedOptions(
  opts: Partial<ProcessedOptions>,
): opts is ProcessedOptions {
  return (
    typeof opts.name === 'string' &&
    typeof opts.appVersion === 'string' &&
    typeof opts.electronVersion === 'string' &&
    typeof opts.ignore !== 'undefined'
  );
}

export class Packager {
  canCreateSymlinks: boolean | undefined = undefined;
  opts: ProcessedOptions;
  tempBase: string;
  useTempDir: boolean;

  constructor(opts: ProcessedOptions) {
    this.opts = opts;
    this.tempBase = baseTempDir(opts);
    this.useTempDir = opts.tmpdir !== false;
  }

  async ensureTempDir() {
    if (this.useTempDir) {
      await fs.promises.rm(this.tempBase, { recursive: true, force: true });
    } else {
      return Promise.resolve();
    }
  }

  async testSymlink(
    comboOpts: ProcessedOptionsWithSinglePlatformArch,
    zipPath: string,
  ) {
    await fs.promises.mkdir(this.tempBase, { recursive: true });
    const testPath = await fs.promises.mkdtemp(
      path.join(
        this.tempBase,
        `symlink-test-${comboOpts.platform}-${comboOpts.arch}-`,
      ),
    );
    const testFile = path.join(testPath, 'test');
    const testLink = path.join(testPath, 'testlink');

    try {
      await promisifiedGracefulFs.writeFile(testFile, '');
      await fs.promises.symlink(testFile, testLink);
      this.canCreateSymlinks = true;
    } catch {
      /* istanbul ignore next */
      this.canCreateSymlinks = false;
    } finally {
      await fs.promises.rm(testPath, { recursive: true, force: true });
    }

    if (this.canCreateSymlinks) {
      return this.checkOverwrite(comboOpts, zipPath);
    }

    /* istanbul ignore next */
    return this.skipHostPlatformSansSymlinkSupport(comboOpts);
  }

  /* istanbul ignore next */
  skipHostPlatformSansSymlinkSupport(
    comboOpts: ProcessedOptionsWithSinglePlatformArch,
  ) {
    info(
      `Cannot create symlinks (on Windows hosts, it requires admin privileges); skipping ${comboOpts.platform} platform`,
      this.opts.quiet,
    );
    return Promise.resolve();
  }

  async overwriteAndCreateApp(
    outDir: string,
    comboOpts: ProcessedOptionsWithSinglePlatformArch,
    zipPath: string,
  ) {
    debug(`Removing ${outDir} due to setting overwrite: true`);
    await fs.promises.rm(outDir, { recursive: true, force: true });
    return this.createApp(comboOpts, zipPath);
  }

  async extractElectronZip(
    comboOpts: ProcessedOptionsWithSinglePlatformArch,
    zipPath: string,
    buildDir: string,
  ) {
    debug(`Extracting ${zipPath} to ${buildDir}`);
    await extractElectronZip(zipPath, buildDir);
    await runHooks(this.opts.afterExtract, {
      buildPath: buildDir,
      electronVersion: comboOpts.electronVersion,
      platform: comboOpts.platform,
      arch: comboOpts.arch,
    });
  }

  async buildDir(
    platform: ProcessedOptionsWithSinglePlatformArch['platform'],
    arch: ProcessedOptionsWithSinglePlatformArch['arch'],
  ) {
    let buildParentDir;
    if (this.useTempDir) {
      buildParentDir = this.tempBase;
    } else {
      buildParentDir = this.opts.out || process.cwd();
    }
    await fs.promises.mkdir(buildParentDir, { recursive: true });
    return await fs.promises.mkdtemp(
      path.resolve(buildParentDir, `${platform}-${arch}-template-`),
    );
  }

  async createApp(
    comboOpts: ProcessedOptionsWithSinglePlatformArch,
    zipPath: string,
  ) {
    const buildDir = await this.buildDir(comboOpts.platform, comboOpts.arch);
    info(
      `Packaging app for platform ${comboOpts.platform} ${comboOpts.arch} using electron v${comboOpts.electronVersion}`,
      this.opts.quiet,
    );

    debug(`Creating ${buildDir}`);
    await fs.promises.mkdir(buildDir, { recursive: true });
    await this.extractElectronZip(comboOpts, zipPath, buildDir);
    const osPackagerPath = url
      .pathToFileURL(`${osModules[comboOpts.platform as OfficialPlatform]}.js`)
      .toString();
    const osPackager = await import(osPackagerPath);
    const app = new osPackager.App(comboOpts, buildDir);
    return app.create();
  }

  async checkOverwrite(
    comboOpts: ProcessedOptionsWithSinglePlatformArch,
    zipPath: string,
  ) {
    const finalPath = generateFinalPath(comboOpts);
    if (fs.existsSync(finalPath)) {
      if (this.opts.overwrite) {
        return this.overwriteAndCreateApp(finalPath, comboOpts, zipPath);
      } else {
        info(
          `Skipping ${comboOpts.platform} ${comboOpts.arch} (output dir already exists, use --overwrite to force)`,
          this.opts.quiet,
        );
        return true;
      }
    } else {
      return this.createApp(comboOpts, zipPath);
    }
  }

  async getElectronZipPath(downloadOpts: DownloadOptions) {
    if (this.opts.electronZipDir) {
      if (fs.existsSync(this.opts.electronZipDir)) {
        const zipPath = path.resolve(
          this.opts.electronZipDir,
          `electron-v${downloadOpts.version}-${downloadOpts.platform}-${downloadOpts.arch}.zip`,
        );
        if (!fs.existsSync(zipPath)) {
          throw new Error(
            `The specified Electron ZIP file does not exist: ${zipPath}`,
          );
        }

        return zipPath;
      }

      throw new Error(
        `The specified Electron ZIP directory does not exist: ${this.opts.electronZipDir}`,
      );
    } else {
      return downloadElectronZip(downloadOpts);
    }
  }

  async packageForPlatformAndArchWithOpts(
    comboOpts: ProcessedOptionsWithSinglePlatformArch,
    downloadOpts: DownloadOptions,
  ) {
    const zipPath = await this.getElectronZipPath(downloadOpts);

    if (!this.useTempDir) {
      return this.createApp(comboOpts, zipPath);
    }

    if (isPlatformMac(comboOpts.platform)) {
      /* istanbul ignore else */
      if (this.canCreateSymlinks === undefined) {
        return this.testSymlink(comboOpts, zipPath);
      } else if (!this.canCreateSymlinks) {
        return this.skipHostPlatformSansSymlinkSupport(comboOpts);
      }
    }

    return this.checkOverwrite(comboOpts, zipPath);
  }

  async packageForPlatformAndArch(downloadOpts: DownloadOptions) {
    // Create delegated options object with specific platform and arch, for output directory naming
    const comboOpts: ProcessedOptionsWithSinglePlatformArch = {
      ...this.opts,
      arch: downloadOpts.arch,
      platform: downloadOpts.platform,
      electronVersion: downloadOpts.version,
    };

    if (isPlatformMac(comboOpts.platform) && comboOpts.arch === 'universal') {
      return packageUniversalMac(
        this.packageForPlatformAndArchWithOpts.bind(this),
        await this.buildDir(comboOpts.platform, comboOpts.arch),
        comboOpts,
        downloadOpts,
        this.tempBase,
      );
    }

    return this.packageForPlatformAndArchWithOpts(comboOpts, downloadOpts);
  }
}

async function packageAllSpecifiedCombos(
  opts: ProcessedOptions,
  archs: OfficialArch[],
  platforms: OfficialPlatform[],
) {
  const packager = new Packager(opts);
  await packager.ensureTempDir();
  return Promise.all(
    createDownloadCombos(opts, platforms, archs).map((downloadOpts) =>
      packager.packageForPlatformAndArch(downloadOpts),
    ),
  );
}

/**
 * Bundles Electron-based application source code with a renamed/customized Electron executable and
 * its supporting files into folders ready for distribution.
 *
 * Briefly, this function:
 * - finds or downloads the correct release of Electron
 * - uses that version of Electron to create a app in `<out>/<appname>-<platform>-<arch>`
 *
 * @example
 *
 * ```javascript
 * import { packager } from '@electron/packager'
 *
 * async function bundleElectronApp(options) {
 *   const appPaths = await packager(options)
 *   console.log(`Electron app bundles created:\n${appPaths.join("\n")}`)
 * }
 * ```
 *
 * @param opts - Options to configure packaging.
 *
 * @returns A Promise containing the paths to the newly created application bundles.
 */
export async function packager(opts: Options): Promise<string[]> {
  await debugHostInfo();

  debug(`Packager Options: ${JSON.stringify(opts)}`);

  const archs = validateListFromOptions(opts, 'arch') as OfficialArch[] | Error;
  const platforms = validateListFromOptions(opts, 'platform') as
    | OfficialPlatform[]
    | Error;

  if (!Array.isArray(archs)) {
    return Promise.reject(archs);
  }

  if (!Array.isArray(platforms)) {
    return Promise.reject(platforms);
  }

  debug(`Target Platforms: ${platforms.join(', ')}`);
  debug(`Target Architectures: ${archs.join(', ')}`);

  const packageJSONDir = path.resolve(process.cwd(), opts.dir) || process.cwd();

  const processedOpts = await createProcessedOptions(
    opts,
    platforms,
    packageJSONDir,
  );

  if (processedOpts.name?.endsWith(' Helper')) {
    throw new Error(
      'Application names cannot end in " Helper" due to limitations on macOS',
    );
  }

  debug(`Application name: ${processedOpts.name}`);
  debug(`Target Electron version: ${processedOpts.electronVersion}`);

  await runHooks(
    processedOpts.afterFinalizePackageTargets,
    createPlatformArchPairs(processedOpts, platforms, archs).map(
      ([platform, arch]) => ({
        platform,
        arch,
      }),
    ),
  );
  const appPaths = await packageAllSpecifiedCombos(
    processedOpts,
    archs,
    platforms,
  );
  // Remove falsy entries (e.g. skipped platforms)
  return appPaths.filter(
    (appPath) => appPath && typeof appPath === 'string',
  ) as string[];
}
