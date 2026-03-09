import fs from 'graceful-fs';
import path from 'node:path';
import {
  createPackageWithOptions as createASARWithOptions,
  FileRecord,
  getRawHeader,
} from '@electron/asar';

import {
  baseTempDir,
  createAsarOpts,
  debug,
  ensureArray,
  generateFinalPath,
  validateElectronApp,
  warning,
} from './common.js';
import { userPathFilter } from './copy-filter.js';
import { runHooks } from './hooks.js';
import crypto from 'node:crypto';
import type { ProcessedOptionsWithSinglePlatformArch } from './types.js';

export class App {
  asarIntegrity:
    | Record<string, Pick<FileRecord['integrity'], 'algorithm' | 'hash'>>
    | undefined = undefined;
  asarOptions: ReturnType<typeof createAsarOpts>;
  cachedStagingPath: string | undefined = undefined;
  opts: ProcessedOptionsWithSinglePlatformArch;
  templatePath: string;

  constructor(
    opts: ProcessedOptionsWithSinglePlatformArch,
    templatePath: string,
  ) {
    this.opts = opts;
    this.templatePath = templatePath;
    this.asarOptions = createAsarOpts(opts);

    if (this.opts.prune === undefined) {
      this.opts.prune = true;
    }
  }

  async create(): Promise<string> {
    /* istanbul ignore next */
    throw new Error('Child classes must implement this');
  }

  /**
   * Resource directory path before renaming.
   */
  get originalResourcesDir(): string {
    return this.resourcesDir;
  }

  /**
   * Resource directory path after renaming.
   */
  get resourcesDir(): string {
    return path.join(this.stagingPath, 'resources');
  }

  get originalResourcesAppDir(): string {
    return path.join(this.originalResourcesDir, 'app');
  }

  get electronBinaryDir(): string {
    return this.stagingPath;
  }

  get originalElectronName(): string {
    /* istanbul ignore next */
    throw new Error('Child classes must implement this');
  }

  get newElectronName(): string {
    /* istanbul ignore next */
    throw new Error('Child classes must implement this');
  }

  get executableName() {
    return this.opts.executableName || this.opts.name;
  }

  get stagingPath() {
    if (this.opts.tmpdir === false) {
      return generateFinalPath(this.opts);
    } else {
      if (!this.cachedStagingPath) {
        const tempDir = baseTempDir(this.opts);
        fs.mkdirSync(tempDir, { recursive: true });
        this.cachedStagingPath = fs.mkdtempSync(path.resolve(tempDir, 'tmp-'));
      }
      return this.cachedStagingPath;
    }
  }

  get appAsarPath() {
    return path.join(this.originalResourcesDir, 'app.asar');
  }

  get commonHookArgs() {
    return {
      electronVersion: this.opts.electronVersion,
      platform: this.opts.platform,
      arch: this.opts.arch,
    };
  }

  get hookArgsWithOriginalResourcesAppDir() {
    return {
      buildPath: this.originalResourcesAppDir,
      ...this.commonHookArgs,
    };
  }

  async relativeRename(basePath: string, oldName: string, newName: string) {
    debug(`Renaming ${oldName} to ${newName} in ${basePath}`);
    await fs.promises.rename(
      path.join(basePath, oldName),
      path.join(basePath, newName),
    );
  }

  async renameElectron() {
    return this.relativeRename(
      this.electronBinaryDir,
      this.originalElectronName,
      this.newElectronName,
    );
  }

  /**
   * Performs the following initial operations for an app:
   * * Creates temporary directory
   * * Remove default_app (which is either a folder or an asar file)
   * * If a prebuilt asar is specified:
   *   * Copies asar into temporary directory as app.asar
   * * Otherwise:
   *   * Copies template into temporary directory
   *   * Copies user's app into temporary directory
   *   * Prunes non-production node_modules (if opts.prune is either truthy or undefined)
   *   * Creates an asar (if opts.asar is set)
   *
   * Prune and asar are performed before platform-specific logic, primarily so that
   * this.originalResourcesAppDir is predictable (e.g. before .app is renamed for Mac)
   */
  async initialize() {
    debug(
      `Initializing app in ${this.stagingPath} from ${this.templatePath} template`,
    );

    try {
      await fs.promises.rm(this.stagingPath, { recursive: true, force: true });
      await fs.promises.rename(this.templatePath, this.stagingPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        // Cross-device link, fallback to copy and delete
        await fs.promises.cp(this.templatePath, this.stagingPath, {
          force: true,
          recursive: true,
          verbatimSymlinks: true,
        });
        await fs.promises.rm(this.templatePath, {
          force: true,
          recursive: true,
        });
      } else {
        throw err;
      }
    }
    await this.removeDefaultApp();
    if (this.opts.prebuiltAsar) {
      await this.copyPrebuiltAsar();
      this.asarIntegrity = {
        [this.appRelativePlatformPath(this.appAsarPath)]: this.getAsarIntegrity(
          this.appAsarPath,
        ),
      };
    } else {
      await this.buildApp();
    }

    await runHooks(
      this.opts.afterInitialize,
      this.hookArgsWithOriginalResourcesAppDir,
    );
  }

  async buildApp() {
    await this.copyTemplate();
    await validateElectronApp(this.opts.dir, this.originalResourcesAppDir);
    await this.asarApp();
  }

  async copyTemplate() {
    await runHooks(
      this.opts.beforeCopy,
      this.hookArgsWithOriginalResourcesAppDir,
    );

    await fs.promises.cp(this.opts.dir, this.originalResourcesAppDir, {
      recursive: true,
      filter: userPathFilter(this.opts),
      dereference:
        typeof this.opts.derefSymlinks === 'boolean'
          ? this.opts.derefSymlinks
          : true,
    });
    await runHooks(
      this.opts.afterCopy,
      this.hookArgsWithOriginalResourcesAppDir,
    );
    if (this.opts.prune) {
      await runHooks(
        this.opts.afterPrune,
        this.hookArgsWithOriginalResourcesAppDir,
      );
    }
  }

  async removeDefaultApp() {
    await Promise.all(
      ['default_app', 'default_app.asar'].map(async (basename) =>
        fs.promises.rm(path.join(this.originalResourcesDir, basename), {
          recursive: true,
          force: true,
        }),
      ),
    );
  }

  /**
   * Forces an icon filename to a given extension and returns the normalized filename,
   * if it exists.  Otherwise, returns null.
   *
   * This error path is used by win32 if no icon is specified.
   */
  async normalizeIconExtension(targetExt: string): Promise<string | void> {
    if (!this.opts.icon) {
      throw new Error('No filename specified to normalizeIconExtension');
    }

    const iconFilenames = Array.isArray(this.opts.icon)
      ? this.opts.icon
      : [this.opts.icon];
    for (let iconFilename of iconFilenames) {
      const ext = path.extname(iconFilename);
      if (ext !== targetExt) {
        iconFilename = path.join(
          path.dirname(iconFilename),
          path.basename(iconFilename, ext) + targetExt,
        );
      }

      if (fs.existsSync(iconFilename)) {
        return iconFilename;
      }
    }

    /* istanbul ignore next */
    warning(
      `Could not find icon "${this.opts.icon}" with extension "${targetExt}", skipping this app icon format`,
      this.opts.quiet,
    );
  }

  prebuiltAsarWarning(
    option: keyof ProcessedOptionsWithSinglePlatformArch,
    triggerWarning: unknown,
  ) {
    if (triggerWarning) {
      warning(
        `prebuiltAsar and ${option} are incompatible, ignoring the ${option} option`,
        this.opts.quiet,
      );
    }
  }

  async copyPrebuiltAsar() {
    if (this.asarOptions) {
      warning(
        'prebuiltAsar has been specified, all asar options will be ignored',
        this.opts.quiet,
      );
    }

    for (const hookName of ['beforeCopy', 'afterCopy', 'afterPrune'] as const) {
      if (this.opts[hookName]) {
        throw new Error(`${hookName} is incompatible with prebuiltAsar`);
      }
    }

    this.prebuiltAsarWarning(
      'ignore',
      (
        this.opts as ProcessedOptionsWithSinglePlatformArch & {
          originalIgnore: ProcessedOptionsWithSinglePlatformArch['ignore'];
        }
      ).originalIgnore,
    );
    this.prebuiltAsarWarning('prune', !this.opts.prune);
    this.prebuiltAsarWarning(
      'derefSymlinks',
      this.opts.derefSymlinks !== undefined,
    );

    const src = path.resolve(this.opts.prebuiltAsar!);

    const stat = await fs.promises.stat(src);
    if (!stat.isFile()) {
      throw new Error(`${src} specified in prebuiltAsar must be an asar file.`);
    }

    debug(`Copying asar: ${src} to ${this.appAsarPath}`);
    await fs.promises.cp(src, this.appAsarPath, {
      force: false,
      errorOnExist: true,
    });
  }

  appRelativePlatformPath(p: string) {
    if (this.opts.platform === 'win32') {
      return path.win32.relative(this.stagingPath, p);
    }

    return path.posix.relative(this.stagingPath, p);
  }

  async asarApp() {
    if (!this.asarOptions) {
      return Promise.resolve();
    }

    debug(`Running asar with the options ${JSON.stringify(this.asarOptions)}`);

    await runHooks(
      this.opts.beforeAsar,
      this.hookArgsWithOriginalResourcesAppDir,
    );

    await createASARWithOptions(
      this.originalResourcesAppDir,
      this.appAsarPath,
      this.asarOptions,
    );
    this.asarIntegrity = {
      [this.appRelativePlatformPath(this.appAsarPath)]: this.getAsarIntegrity(
        this.appAsarPath,
      ),
    };
    await fs.promises.rm(this.originalResourcesAppDir, {
      recursive: true,
      force: true,
    });

    await runHooks(
      this.opts.afterAsar,
      this.hookArgsWithOriginalResourcesAppDir,
    );
  }

  getAsarIntegrity(
    path: string,
  ): Pick<FileRecord['integrity'], 'algorithm' | 'hash'> {
    const { headerString } = getRawHeader(path);
    return {
      algorithm: 'SHA256',
      hash: crypto.createHash('SHA256').update(headerString).digest('hex'),
    };
  }

  async copyExtraResources() {
    if (!this.opts.extraResource) {
      return Promise.resolve();
    }

    const extraResources = ensureArray(this.opts.extraResource);

    const hookArgs = {
      buildPath: this.stagingPath,
      ...this.commonHookArgs,
    };

    await runHooks(this.opts.beforeCopyExtraResources, hookArgs);

    await Promise.all(
      extraResources.map((resource) =>
        fs.promises.cp(
          resource,
          path.resolve(
            this.stagingPath,
            this.resourcesDir,
            path.basename(resource),
          ),
          { recursive: true },
        ),
      ),
    );

    await runHooks(this.opts.afterCopyExtraResources, hookArgs);
  }

  async move() {
    const finalPath = generateFinalPath(this.opts);

    if (this.opts.tmpdir !== false) {
      debug(`Moving ${this.stagingPath} to ${finalPath}`);
      try {
        await fs.promises.mkdir(path.resolve(finalPath, '..'), {
          recursive: true,
        });
        await fs.promises.rename(this.stagingPath, finalPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
          // Cross-device link, fallback to copy and delete
          await fs.promises.cp(this.stagingPath, finalPath, {
            force: true,
            recursive: true,
            verbatimSymlinks: true,
          });
          await fs.promises.rm(this.stagingPath, {
            force: true,
            recursive: true,
          });
        } else {
          throw err;
        }
      }
    }

    if (this.opts.afterComplete) {
      const hookArgs = {
        buildPath: finalPath,
        ...this.commonHookArgs,
      };

      await runHooks(this.opts.afterComplete, hookArgs);
    }

    return finalPath;
  }
}
