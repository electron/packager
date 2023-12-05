import { App } from './platform';
import { debug, sanitizeAppName, subOptionWarning, warning } from './common';
import fs from 'fs-extra';
import path from 'path';
import plist, { PlistValue } from 'plist';
import { notarize, NotarizeOptions } from '@electron/notarize';
import { signApp } from '@electron/osx-sign';
import { ComboOptions } from './types';
import { SignOptions } from '@electron/osx-sign/dist/cjs/types';

type NSUsageDescription = {
  [key in `NS${string}UsageDescription`]: string
}

type BasePList = {
  CFBundleDisplayName: string
  CFBundleExecutable: string
  CFBundleIdentifier: string | undefined
  CFBundleName: string
  CFBundleShortVersionString: string
  CFBundleVersion: string
} & NSUsageDescription

interface Plists {
  appPlist?: (BasePList & {
    CFBundleIconFile: string
    // eslint-disable-next-line no-use-before-define
    CFBundleURLTypes: MacApp['protocols']
    ElectronAsarIntegrity: App['asarIntegrity']
    LSApplicationCategoryType: string
    NSHumanReadableCopyright: string
    NSRequiresAquaSystemAppearance: boolean
  });
  helperEHPlist?: BasePList
  helperGPUPlist?: BasePList
  helperNPPlist?: BasePList
  helperPlist?: BasePList
  helperPluginPlist?: BasePList
  helperRendererPlist?: BasePList
  loginHelperPlist?: BasePList
}

type PlistNames = keyof Plists

// eslint-disable-next-line no-use-before-define
type LoadPlistParams = Parameters<MacApp['loadPlist']>

export class MacApp extends App implements Plists {
  appName: string;
  appPlist: Plists['appPlist'];
  helperBundleIdentifier: string | undefined;
  helperEHPlist: Plists['helperEHPlist'];
  helperGPUPlist: Plists['helperGPUPlist'];
  helperNPPlist: Plists['helperNPPlist'];
  helperPlist: Plists['helperPlist'];
  helperPluginPlist: Plists['helperPluginPlist'];
  helperRendererPlist: Plists['helperRendererPlist'];
  loginHelperPlist: Plists['loginHelperPlist'];

  constructor(opts: ComboOptions, templatePath: string) {
    super(opts, templatePath);

    this.appName = opts.name as string;
  }

  get appCategoryType() {
    return this.opts.appCategoryType;
  }

  get appCopyright() {
    return this.opts.appCopyright;
  }

  get appVersion() {
    return this.opts.appVersion;
  }

  get buildVersion() {
    return this.opts.buildVersion;
  }

  get enableDarkMode() {
    return this.opts.darwinDarkModeSupport;
  }

  get usageDescription() {
    return this.opts.usageDescription;
  }

  get protocols() {
    return (this.opts.protocols || []).map((protocol) => {
      return {
        CFBundleURLName: protocol.name,
        CFBundleURLSchemes: [...protocol.schemes],
      };
    });
  }

  get dotAppName() {
    return `${sanitizeAppName(this.appName)}.app`;
  }

  get defaultBundleName() {
    return `com.electron.${sanitizeAppName(this.appName).toLowerCase()}`;
  }

  get bundleName() {
    return filterCFBundleIdentifier(this.opts.appBundleId || this.defaultBundleName);
  }

  get originalResourcesDir() {
    return path.join(this.contentsPath, 'Resources');
  }

  get resourcesDir() {
    return path.join(this.dotAppName, 'Contents', 'Resources');
  }

  get electronBinaryDir() {
    return path.join(this.contentsPath, 'MacOS');
  }

  get originalElectronName() {
    return 'Electron';
  }

  get newElectronName() {
    return this.appPlist!.CFBundleExecutable;
  }

  get renamedAppPath() {
    return path.join(this.stagingPath, this.dotAppName);
  }

  get electronAppPath() {
    return path.join(this.stagingPath, `${this.originalElectronName}.app`);
  }

  get contentsPath() {
    return path.join(this.electronAppPath, 'Contents');
  }

  get frameworksPath() {
    return path.join(this.contentsPath, 'Frameworks');
  }

  get loginItemsPath() {
    return path.join(this.contentsPath, 'Library', 'LoginItems');
  }

  get loginHelperPath() {
    return path.join(this.loginItemsPath, 'Electron Login Helper.app');
  }

  updatePlist<T extends BasePList = BasePList>(basePlist: T, displayName: string, identifier: string | undefined,
    name: string): T {
    return Object.assign(basePlist!, {
      CFBundleDisplayName: displayName,
      CFBundleExecutable: sanitizeAppName(displayName),
      CFBundleIdentifier: identifier,
      CFBundleName: sanitizeAppName(name),
    });
  }

  updateHelperPlist(helperPlist: MacApp['helperPlist'], suffix?: string, identifierIgnoresSuffix?: boolean) {
    let helperSuffix: string, identifier: typeof this.helperBundleIdentifier, name: string;

    if (suffix) {
      helperSuffix = `Helper ${suffix}`;
      if (identifierIgnoresSuffix) {
        identifier = this.helperBundleIdentifier;
      } else {
        identifier = `${this.helperBundleIdentifier}.${suffix}`;
      }
      name = `${this.appName} ${helperSuffix}`;
    } else {
      helperSuffix = 'Helper';
      identifier = this.helperBundleIdentifier;
      name = this.appName;
    }
    return this.updatePlist(helperPlist!, `${this.appName} ${helperSuffix}`, identifier, name);
  }

  async extendPlist(basePlist: BasePList, propsOrFilename: ComboOptions['extendInfo' | 'extendHelperInfo']) {
    if (!propsOrFilename) {
      return Promise.resolve();
    }

    if (typeof propsOrFilename === 'string') {
      const plist = await this.loadPlist(propsOrFilename);
      return Object.assign(basePlist, plist);
    } else {
      return Object.assign(basePlist, propsOrFilename);
    }
  }

  async loadPlist(filename: string, propName?: PlistNames) {
    const loadedPlist = plist.parse((await fs.readFile(filename)).toString());
    if (propName) {
      (this[propName] as unknown) = loadedPlist;
    }
    return loadedPlist;
  }

  ehPlistFilename(helper: string) {
    return this.helperPlistFilename(path.join(this.frameworksPath, helper));
  }

  helperPlistFilename(helperApp: string) {
    return path.join(helperApp, 'Contents', 'Info.plist');
  }

  async determinePlistFilesToUpdate(): Promise<LoadPlistParams[]> {
    const appPlistFilename = path.join(this.contentsPath, 'Info.plist');

    const plists = [
      [appPlistFilename, 'appPlist'],
      [this.ehPlistFilename('Electron Helper.app'), 'helperPlist'],
    ] as LoadPlistParams[];

    const possiblePlists = [
      [this.ehPlistFilename('Electron Helper (Renderer).app'), 'helperRendererPlist'],
      [this.ehPlistFilename('Electron Helper (Plugin).app'), 'helperPluginPlist'],
      [this.ehPlistFilename('Electron Helper (GPU).app'), 'helperGPUPlist'],
      [this.ehPlistFilename('Electron Helper EH.app'), 'helperEHPlist'],
      [this.ehPlistFilename('Electron Helper NP.app'), 'helperNPPlist'],
      [this.helperPlistFilename(this.loginHelperPath), 'loginHelperPlist'],
    ];

    const optional = await Promise.all(possiblePlists.map(async item =>
      (await fs.pathExists(item[0])) ? item : null));

    return [...plists, ...(optional as LoadPlistParams[]).filter(item => item)];
  }

  appRelativePath(p: string) {
    return path.relative(this.contentsPath, p);
  }

  async updatePlistFiles() {
    const appBundleIdentifier = this.bundleName;
    this.helperBundleIdentifier = filterCFBundleIdentifier(this.opts.helperBundleId || `${appBundleIdentifier}.helper`);

    const plists = await this.determinePlistFilesToUpdate();
    await Promise.all(plists.map(plistArgs => this.loadPlist(...plistArgs)));
    await this.extendPlist(this.appPlist!, this.opts.extendInfo);
    if (this.asarIntegrity) {
      await this.extendPlist(this.appPlist!, {
        ElectronAsarIntegrity: this.asarIntegrity,
      });
    } else {
      delete this.appPlist?.ElectronAsarIntegrity;
    }
    this.appPlist = this.updatePlist(this.appPlist!, this.executableName!, appBundleIdentifier, this.appName);

    const updateIfExists = [
      ['helperRendererPlist', '(Renderer)', true],
      ['helperPluginPlist', '(Plugin)', true],
      ['helperGPUPlist', '(GPU)', true],
      ['helperEHPlist', 'EH'],
      ['helperNPPlist', 'NP'],
    ] as unknown as Array<[PlistNames, string, boolean?]>;

    for (const [plistKey] of [...updateIfExists, (['helperPlist'] as PlistNames[])]) {
      if (!this[plistKey]) {
        continue;
      }
      await this.extendPlist(this[plistKey] as BasePList, this.opts.extendHelperInfo);
    }

    this.helperPlist = this.updateHelperPlist(this.helperPlist);
    for (const [plistKey, ...suffixArgs] of updateIfExists) {
      if (!this[plistKey]) {
        continue;
      }
      (this[plistKey] as unknown) = this.updateHelperPlist(this[plistKey], ...suffixArgs);
    }

    // Some properties need to go on all helpers as well, version, usage info, etc.
    const plistsToUpdate = updateIfExists
      .filter(([key]) => !!this[key])
      .map(([key]) => key)
      .concat(['appPlist', 'helperPlist']);

    if (this.loginHelperPlist) {
      const loginHelperName = sanitizeAppName(`${this.appName} Login Helper`);
      this.loginHelperPlist.CFBundleExecutable = loginHelperName;
      this.loginHelperPlist.CFBundleIdentifier = `${appBundleIdentifier}.loginhelper`;
      this.loginHelperPlist.CFBundleName = loginHelperName;
    }

    if (this.appVersion) {
      const appVersionString = '' + this.appVersion;
      for (const plistKey of plistsToUpdate) {
        this[plistKey]!.CFBundleShortVersionString = this[plistKey]!.CFBundleVersion = appVersionString;
      }
    }

    if (this.buildVersion) {
      const buildVersionString = '' + this.buildVersion;
      for (const plistKey of plistsToUpdate) {
        this[plistKey]!.CFBundleVersion = buildVersionString;
      }
    }

    if (this.opts.protocols && this.opts.protocols.length) {
      this.appPlist.CFBundleURLTypes = this.protocols;
    }

    if (this.appCategoryType) {
      this.appPlist.LSApplicationCategoryType = this.appCategoryType;
    }

    if (this.appCopyright) {
      this.appPlist.NSHumanReadableCopyright = this.appCopyright;
    }

    if (this.enableDarkMode) {
      this.appPlist.NSRequiresAquaSystemAppearance = false;
    }

    if (this.usageDescription) {
      for (const [type, description] of Object.entries(this.usageDescription)) {
        const usageTypeKey = `NS${type}UsageDescription` as keyof BasePList;
        for (const plistKey of plistsToUpdate) {
          this[plistKey]![usageTypeKey] = description;
        }
        this.appPlist[usageTypeKey] = description;
      }
    }

    await Promise.all(plists.map(([filename, varName]) =>
      fs.writeFile(filename, plist.build(this[varName as PlistNames] as PlistValue))));
  }

  async moveHelpers() {
    const helpers = [' Helper', ' Helper EH', ' Helper NP', ' Helper (Renderer)', ' Helper (Plugin)', ' Helper (GPU)'];
    await Promise.all(helpers.map(suffix => this.moveHelper(this.frameworksPath, suffix)));
    if (await fs.pathExists(this.loginItemsPath)) {
      await this.moveHelper(this.loginItemsPath, ' Login Helper');
    }
  }

  async moveHelper(helperDirectory: string, suffix: string) {
    const originalBasename = `Electron${suffix}`;

    if (await fs.pathExists(path.join(helperDirectory, `${originalBasename}.app`))) {
      return this.renameHelperAndExecutable(
        helperDirectory,
        originalBasename,
        `${sanitizeAppName(this.appName)}${suffix}`,
      );
    } else {
      return Promise.resolve();
    }
  }

  async renameHelperAndExecutable(helperDirectory: string, originalBasename: string, newBasename: string) {
    const originalAppname = `${originalBasename}.app`;
    const executableBasePath = path.join(helperDirectory, originalAppname, 'Contents', 'MacOS');
    await this.relativeRename(executableBasePath, originalBasename, newBasename);
    await this.relativeRename(helperDirectory, originalAppname, `${newBasename}.app`);
  }

  async copyIcon() {
    if (!this.opts.icon) {
      return Promise.resolve();
    }

    let icon;

    try {
      icon = await this.normalizeIconExtension('.icns');
    } catch {
      // Ignore error if icon doesn't exist, in case it's only available for other OSes
      /* istanbul ignore next */
      return Promise.resolve();
    }
    if (icon) {
      debug(`Copying icon "${icon}" to app's Resources as "${this.appPlist!.CFBundleIconFile}"`);
      await fs.copy(icon, path.join(this.originalResourcesDir, this.appPlist!.CFBundleIconFile));
    }
  }

  async renameAppAndHelpers() {
    await this.moveHelpers();
    await fs.rename(this.electronAppPath, this.renamedAppPath);
  }

  async signAppIfSpecified() {
    const osxSignOpt = this.opts.osxSign;
    const platform = this.opts.platform;
    const version = this.opts.electronVersion;

    if ((platform === 'all' || platform === 'mas') &&
      osxSignOpt === undefined) {
      warning('signing is required for mas builds. Provide the osx-sign option, ' +
        'or manually sign the app later.', this.opts.quiet);
    }

    if (osxSignOpt) {
      const signOpts = createSignOpts(osxSignOpt, platform, this.renamedAppPath, version, this.opts.quiet);
      debug(`Running @electron/osx-sign with the options ${JSON.stringify(signOpts)}`);
      try {
        await signApp(signOpts as SignOptions);
      } catch (err) {
        // Although not signed successfully, the application is packed.
        if (signOpts.continueOnError) {
          warning(`Code sign failed; please retry manually. ${err}`, this.opts.quiet);
        } else {
          throw err;
        }
      }
    }
  }

  async notarizeAppIfSpecified() {
    const osxNotarizeOpt = this.opts.osxNotarize;

    /* istanbul ignore if */
    if (osxNotarizeOpt) {
      const notarizeOpts = createNotarizeOpts(
        osxNotarizeOpt,
        this.bundleName,
        this.renamedAppPath,
        Boolean(this.opts.quiet),
      );
      if (notarizeOpts) {
        return notarize(notarizeOpts);
      }
    }
  }

  async create() {
    await this.initialize();
    await this.updatePlistFiles();
    await this.copyIcon();
    await this.renameElectron();
    await this.renameAppAndHelpers();
    await this.copyExtraResources();
    await this.signAppIfSpecified();
    await this.notarizeAppIfSpecified();
    return this.move();
  }
}

export { MacApp as App };

/**
 * Remove special characters and allow only alphanumeric (A-Z,a-z,0-9), hyphen (-), and period (.)
 * Apple documentation:
 * https://developer.apple.com/library/mac/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html#//apple_ref/doc/uid/20001431-102070
 */
export function filterCFBundleIdentifier(identifier: ComboOptions['appBundleId']) {
  return identifier!.replace(/ /g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
}

type Mutable<T> = {
  -readonly [key in keyof T]: T[key];
}

type CreateSignOptsResult = Mutable<SignOptions & {
  continueOnError?: boolean
}>

export function createSignOpts(properties: ComboOptions['osxSign'], platform: ComboOptions['platform'], app: string,
  version: ComboOptions['electronVersion'], quiet?: boolean): CreateSignOptsResult {
  // use default sign opts if osx-sign is true, otherwise clone osx-sign object
  const signOpts = (properties === true ? { identity: null } : { ...properties }) as CreateSignOptsResult;

  // osx-sign options are handed off to sign module, but
  // with a few additions from the main options
  // user may think they can pass platform, app, or version, but they will be ignored
  subOptionWarning(signOpts, 'osx-sign', 'platform', platform, quiet);
  subOptionWarning(signOpts, 'osx-sign', 'app', app, quiet);
  subOptionWarning(signOpts, 'osx-sign', 'version', version, quiet);

  if (signOpts.binaries) {
    warning('osx-sign.binaries is not an allowed sub-option. Not passing to @electron/osx-sign.', quiet);
    delete signOpts.binaries;
  }

  // Take argument osx-sign as signing identity:
  // if opts.osxSign is true (bool), fallback to identity=null for
  // autodiscovery. Otherwise, provide signing certificate info.
  if ((signOpts.identity as unknown) === true) {
    (signOpts.identity as unknown) = null;
  }

  // Default to `continueOnError: true` since this was the default behavior before this option was added
  if (signOpts.continueOnError !== false) {
    signOpts.continueOnError = true;
  }

  return signOpts;
}

export function createNotarizeOpts(properties: ComboOptions['osxNotarize'], appBundleId: string, appPath: string,
  quiet: boolean): NotarizeOptions {
  // osxNotarize options are handed off to the @electron/notarize module, but with a few
  // additions from the main options. The user may think they can pass appPath,
  // but it will be ignored.
  subOptionWarning(properties as unknown as Record<string, unknown>, 'osxNotarize', 'appPath', appPath, quiet);
  return properties as NotarizeOptions;
}
