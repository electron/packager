import path from 'path';
import { WrapperError } from 'cross-spawn-windows-exe';

import App from './platform';
import { debug, sanitizeAppName } from './common';
import rcedit, { Options as RceditOptions } from 'rcedit';
import { Options } from './types';

export function updateWineMissingException(err: Error) {
  if (err instanceof WrapperError) {
    err.message += '\n\n' +
      'Wine is required to use the appCopyright, appVersion, buildVersion, icon, and \n' +
      'win32metadata parameters for Windows targets.\n\n' +
      'See https://github.com/electron/packager#building-windows-apps-from-non-windows-platforms for details.';
  }

  return err;
}

class WindowsApp extends App {
  get originalElectronName() {
    return 'electron.exe';
  }

  get newElectronName() {
    return `${sanitizeAppName(this.executableName!)}.exe`;
  }

  get electronBinaryPath() {
    return path.join(this.stagingPath, this.newElectronName);
  }

  generateRceditOptionsSansIcon(): RceditOptions {
    const win32metadata: Options['win32metadata'] = {
      FileDescription: this.opts.name,
      InternalName: this.opts.name,
      OriginalFilename: this.newElectronName,
      ProductName: this.opts.name,
      ...this.opts.win32metadata,
    };

    const rcOpts: RceditOptions = { 'version-string': win32metadata };

    if (this.opts.appVersion) {
      rcOpts['product-version'] = rcOpts['file-version'] = this.opts.appVersion;
    }

    if (this.opts.buildVersion) {
      rcOpts['file-version'] = this.opts.buildVersion;
    }

    if (this.opts.appCopyright) {
      rcOpts['version-string']!.LegalCopyright = this.opts.appCopyright;
    }

    const manifestProperties = ['application-manifest', 'requested-execution-level'];
    for (const manifestProperty of manifestProperties) {
      if (win32metadata[manifestProperty as keyof typeof win32metadata]) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        rcOpts[manifestProperty] = win32metadata[manifestProperty];
      }
    }

    return rcOpts;
  }

  async getIconPath() {
    if (!this.opts.icon) {
      return Promise.resolve();
    }

    return this.normalizeIconExtension('.ico');
  }

  needsRcedit() {
    return Boolean(this.opts.icon || this.opts.win32metadata || this.opts.appCopyright || this.opts.appVersion || this.opts.buildVersion);
  }

  async runRcedit() {
    /* istanbul ignore if */
    if (!this.needsRcedit()) {
      return Promise.resolve();
    }

    const rcOpts = this.generateRceditOptionsSansIcon();

    // Icon might be omitted or only exist in one OS's format, so skip it if normalizeExt reports an error
    const icon = await this.getIconPath();
    if (icon) {
      rcOpts.icon = icon;
    }

    debug(`Running rcedit with the options ${JSON.stringify(rcOpts)}`);
    try {
      await rcedit(this.electronBinaryPath, rcOpts);
    } catch (err) {
      throw updateWineMissingException(err as Error);
    }
  }

  async create() {
    await this.initialize();
    await this.renameElectron();
    await this.copyExtraResources();
    await this.runRcedit();
    return this.move();
  }
}

export { WindowsApp as App };
