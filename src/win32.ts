import path from 'path';
import { sign } from '@electron/windows-sign';
import { SignOptions as WindowsInternalSignOptions } from '@electron/windows-sign/dist/esm/types';
import { App } from './platform';
import { debug, sanitizeAppName, warning } from './common';
import { ComboOptions, Options, WindowsSignOptions } from './types';
import { ExeMetadata, resedit } from './resedit';

export class WindowsApp extends App {
  get originalElectronName() {
    return 'electron.exe';
  }

  get newElectronName() {
    return `${sanitizeAppName(this.executableName!)}.exe`;
  }

  get electronBinaryPath() {
    return path.join(this.stagingPath, this.newElectronName);
  }

  generateReseditOptionsSansIcon(): ExeMetadata {
    const win32Metadata: Options['win32metadata'] = {
      FileDescription: this.opts.name,
      InternalName: this.opts.name,
      OriginalFilename: this.newElectronName,
      ProductName: this.opts.name,
      ...this.opts.win32metadata,
    };

    return {
      productVersion: this.opts.appVersion,
      fileVersion: this.opts.buildVersion || this.opts.appVersion,
      legalCopyright: this.opts.appCopyright,
      productName: this.opts.win32metadata?.ProductName || this.opts.name,
      asarIntegrity: this.asarIntegrity,
      win32Metadata,
    };
  }

  async getIconPath(): Promise<string | void> {
    if (!this.opts.icon) {
      return Promise.resolve();
    }
    if (Array.isArray(this.opts.icon)) {
      throw new Error('opts.path must be a single path on Windows');
    }

    return this.normalizeIconExtension('.ico');
  }

  needsResedit() {
    return Boolean(
      this.opts.icon ||
        this.opts.win32metadata ||
        this.opts.appCopyright ||
        this.opts.appVersion ||
        this.opts.buildVersion ||
        this.opts.name,
    );
  }

  async runResedit() {
    /* istanbul ignore if */
    if (!this.needsResedit()) {
      return Promise.resolve();
    }

    const resOpts = this.generateReseditOptionsSansIcon();

    // Icon might be omitted or only exist in one OS's format, so skip it if normalizeExt reports an error
    const icon = await this.getIconPath();
    if (icon) {
      resOpts.iconPath = icon;
    }

    debug(`Running resedit with the options ${JSON.stringify(resOpts)}`);
    await resedit(this.electronBinaryPath, resOpts);
  }

  async signAppIfSpecified() {
    const windowsSignOpt = this.opts.windowsSign;
    const windowsMetaData = this.opts.win32metadata;

    if (windowsSignOpt) {
      const signOpts = createSignOpts(
        windowsSignOpt,
        windowsMetaData,
        this.stagingPath,
      );
      debug(
        `Running @electron/windows-sign with the options ${JSON.stringify(signOpts)}`,
      );
      try {
        await sign(signOpts as WindowsInternalSignOptions);
      } catch (err) {
        // Although not signed successfully, the application is packed.
        if (signOpts.continueOnError) {
          warning(
            `Code sign failed; please retry manually. ${err}`,
            this.opts.quiet,
          );
        } else {
          throw err;
        }
      }
    }
  }

  async create() {
    await this.initialize();
    await this.renameElectron();
    await this.copyExtraResources();
    await this.runResedit();
    await this.signAppIfSpecified();
    return this.move();
  }
}

function createSignOpts(
  properties: ComboOptions['windowsSign'],
  windowsMetaData: ComboOptions['win32metadata'],
  appDirectory: string,
): WindowsSignOptions & WindowsInternalSignOptions {
  let result: WindowsSignOptions = {};

  if (typeof properties === 'object') {
    result = { ...properties };
  }

  // A little bit of convenience
  if (
    windowsMetaData &&
    windowsMetaData.FileDescription &&
    !result.description
  ) {
    result.description = windowsMetaData.FileDescription;
  }

  return { ...result, appDirectory };
}

export { WindowsApp as App };
