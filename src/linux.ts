import { App } from './platform';
import { sanitizeAppName } from './common';

export class LinuxApp extends App {
  get originalElectronName() {
    return 'electron';
  }

  get newElectronName() {
    return sanitizeAppName(this.executableName!);
  }

  async create() {
    await this.initialize();
    await this.renameElectron();
    await this.copyExtraResources();
    return this.move();
  }
}

export { LinuxApp as App };
