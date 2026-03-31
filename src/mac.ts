import { App } from './platform.js';
import { debug, sanitizeAppName, subOptionWarning, warning } from './common.js';
import fs from 'graceful-fs';
import { promisifiedGracefulFs } from './util.js';
import crypto from 'node:crypto';
import path from 'node:path';
import plist, { PlistObject, PlistValue } from 'plist';
import { notarize, NotarizeOptions } from '@electron/notarize';
import { ElectronMacPlatform, sign, SignOptions } from '@electron/osx-sign';
import semver from 'semver';
import { ProcessedOptionsWithSinglePlatformArch } from './types.js';
import { generateAssetCatalogForIcon } from './icon-composer.js';

type NSUsageDescription = {
  [key in `NS${string}UsageDescription`]: string;
};

type AsarIntegrity = NonNullable<App['asarIntegrity']>;

function isAsarIntegrity(value: unknown): value is AsarIntegrity {
  if (typeof value !== 'object' || value === null) return false;
  const entries = Object.values(value);
  if (entries.length === 0) return false;
  return entries.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'algorithm' in entry &&
      typeof entry.algorithm === 'string' &&
      entry.algorithm.length > 0 &&
      'hash' in entry &&
      typeof entry.hash === 'string' &&
      entry.hash.length > 0,
  );
}

/**
 * Scans `frameworkPath` for integrity digest sentinels and patches the 34-byte
 * slot after each with {used=1, version=1, digest}. Reads in 4 MB chunks with
 * two workers so Buffer.indexOf overlaps with disk I/O, and writes positionally
 * so only the changed bytes hit disk. Chunks overread by (sentinel.length - 1)
 * bytes so a sentinel straddling a boundary is still detected.
 * @see https://github.com/electron/fuses/pull/96
 */
async function writeIntegrityDigest(
  frameworkPath: string,
  sentinel: Buffer,
  digest: Buffer,
  quiet: boolean | undefined,
): Promise<void> {
  const PAYLOAD_LEN = 34; // used(1) + version(1) + SHA256(32)
  const SCAN_CHUNK_SIZE = 4 * 1024 * 1024;
  const SCAN_CONCURRENCY = 2;
  const overlap = sentinel.length - 1;

  const handle = await fs.promises.open(frameworkPath, 'r+');
  try {
    const { size } = await handle.stat();
    const numChunks = Math.ceil(size / SCAN_CHUNK_SIZE);
    const positions: number[] = [];

    let next = 0;
    const worker = async () => {
      const buf = Buffer.allocUnsafe(SCAN_CHUNK_SIZE + overlap);
      for (let chunk = next++; chunk < numChunks; chunk = next++) {
        const start = chunk * SCAN_CHUNK_SIZE;
        const len = Math.min(SCAN_CHUNK_SIZE + overlap, size - start);
        const { bytesRead } = await handle.read(buf, 0, len, start);
        const haystack = buf.subarray(0, bytesRead);

        let idx = haystack.indexOf(sentinel);
        while (idx !== -1) {
          positions.push(start + idx);
          idx = haystack.indexOf(sentinel, idx + 1);
        }
      }
    };

    const workers = Math.min(SCAN_CONCURRENCY, numChunks);
    await Promise.all(Array.from({ length: workers }, worker));
    positions.sort((a, b) => a - b);

    if (positions.length === 0) {
      warning(
        `No integrity digest sentinel found in Electron Framework binary at ${frameworkPath}. ` +
          'This is unexpected for Electron >= 41.0.0. The asar integrity digest was not written.',
        quiet,
      );
      return;
    }

    // Validate every slot has room before touching the file, so a failure
    // on one slice doesn't leave the binary half-modified.
    const writePositions: number[] = [];
    for (const sentinelIndex of positions) {
      const base = sentinelIndex + sentinel.length;
      if (base + PAYLOAD_LEN > size) {
        warning(
          `Insufficient space after integrity digest sentinel at offset ${sentinelIndex} in Electron Framework binary. The binary may be corrupted or incompatible.`,
          quiet,
        );
        continue;
      }
      writePositions.push(base);
    }

    if (writePositions.length === 0) {
      throw new Error(
        'Found integrity digest sentinel(s) in Electron Framework binary but could not write to any of them. The binary may be corrupted.',
      );
    }

    const payload = Buffer.allocUnsafe(PAYLOAD_LEN);
    payload.writeUInt8(1, 0); // used = true
    payload.writeUInt8(1, 1); // version = 1
    digest.copy(payload, 2); // 32-byte SHA256 digest

    try {
      for (const base of writePositions) {
        await handle.write(payload, 0, payload.length, base);
      }
    } catch (err) {
      throw new Error(
        `Failed to write integrity digest to Electron Framework binary at ${frameworkPath}: ${err}`,
      );
    }
    debug('Wrote integrity digest to Electron Framework binary');
  } finally {
    await handle.close();
  }
}

type BasePList = {
  CFBundleDisplayName: string;
  CFBundleExecutable: string;
  CFBundleIdentifier: string | undefined;
  CFBundleName: string;
  CFBundleShortVersionString: string;
  CFBundleVersion: string;
} & NSUsageDescription;

interface Plists {
  appPlist?: BasePList & {
    CFBundleIconFile: string;
    CFBundleIconName: string;
    // eslint-disable-next-line no-use-before-define
    CFBundleURLTypes: MacApp['protocols'];
    ElectronAsarIntegrity: App['asarIntegrity'];
    LSApplicationCategoryType: string;
    NSHumanReadableCopyright: string;
    NSRequiresAquaSystemAppearance: boolean;
  };
  helperEHPlist?: BasePList;
  helperGPUPlist?: BasePList;
  helperNPPlist?: BasePList;
  helperPlist?: BasePList;
  helperPluginPlist?: BasePList;
  helperRendererPlist?: BasePList;
  loginHelperPlist?: BasePList;
}

type PlistNames = keyof Plists;

// eslint-disable-next-line no-use-before-define
type LoadPlistParams = Parameters<MacApp['loadPlist']>;

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

  constructor(
    opts: ProcessedOptionsWithSinglePlatformArch,
    templatePath: string,
  ) {
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
    return filterCFBundleIdentifier(
      this.opts.appBundleId || this.defaultBundleName,
    );
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

  updatePlist<T extends BasePList = BasePList>(
    basePlist: T,
    displayName: string,
    identifier: string | undefined,
    name: string,
  ): T {
    return Object.assign(basePlist!, {
      CFBundleDisplayName: displayName,
      CFBundleExecutable: sanitizeAppName(displayName),
      CFBundleIdentifier: identifier,
      CFBundleName: sanitizeAppName(name),
    });
  }

  updateHelperPlist(
    helperPlist: MacApp['helperPlist'],
    suffix?: string,
    identifierIgnoresSuffix?: boolean,
  ) {
    let helperSuffix: string,
      identifier: typeof this.helperBundleIdentifier,
      name: string;

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
    return this.updatePlist(
      helperPlist!,
      `${this.appName} ${helperSuffix}`,
      identifier,
      name,
    );
  }

  async extendPlist(
    basePlist: BasePList,
    propsOrFilename: ProcessedOptionsWithSinglePlatformArch[
      | 'extendInfo'
      | 'extendHelperInfo'],
  ) {
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
    const loadedPlist = plist.parse(
      (await promisifiedGracefulFs.readFile(filename)).toString(),
    );
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
      [
        this.ehPlistFilename('Electron Helper (Renderer).app'),
        'helperRendererPlist',
      ],
      [
        this.ehPlistFilename('Electron Helper (Plugin).app'),
        'helperPluginPlist',
      ],
      [this.ehPlistFilename('Electron Helper (GPU).app'), 'helperGPUPlist'],
      [this.ehPlistFilename('Electron Helper EH.app'), 'helperEHPlist'],
      [this.ehPlistFilename('Electron Helper NP.app'), 'helperNPPlist'],
      [this.helperPlistFilename(this.loginHelperPath), 'loginHelperPlist'],
    ];

    const optional = await Promise.all(
      possiblePlists.map(async (item) =>
        fs.existsSync(item[0]) ? item : null,
      ),
    );

    return [
      ...plists,
      ...(optional as LoadPlistParams[]).filter((item) => item),
    ];
  }

  appRelativePlatformPath(p: string) {
    return path.posix.relative(this.contentsPath, p);
  }

  async updatePlistFiles() {
    const appBundleIdentifier = this.bundleName;
    this.helperBundleIdentifier = filterCFBundleIdentifier(
      this.opts.helperBundleId || `${appBundleIdentifier}.helper`,
    );

    const plists = await this.determinePlistFilesToUpdate();
    await Promise.all(plists.map((plistArgs) => this.loadPlist(...plistArgs)));
    await this.extendPlist(this.appPlist!, this.opts.extendInfo);
    if (this.asarIntegrity) {
      await this.extendPlist(this.appPlist!, {
        ElectronAsarIntegrity: this.asarIntegrity,
      });
    } else {
      delete this.appPlist?.ElectronAsarIntegrity;
    }
    this.appPlist = this.updatePlist(
      this.appPlist!,
      this.executableName!,
      appBundleIdentifier,
      this.appName,
    );

    const updateIfExists = [
      ['helperRendererPlist', '(Renderer)', true],
      ['helperPluginPlist', '(Plugin)', true],
      ['helperGPUPlist', '(GPU)', true],
      ['helperEHPlist', 'EH'],
      ['helperNPPlist', 'NP'],
    ] as unknown as Array<[PlistNames, string, boolean?]>;

    for (const [plistKey] of [
      ...updateIfExists,
      ['helperPlist'] as PlistNames[],
    ]) {
      if (!this[plistKey]) {
        continue;
      }
      await this.extendPlist(
        this[plistKey] as BasePList,
        this.opts.extendHelperInfo,
      );
    }

    this.helperPlist = this.updateHelperPlist(this.helperPlist);
    for (const [plistKey, ...suffixArgs] of updateIfExists) {
      if (!this[plistKey]) {
        continue;
      }
      (this[plistKey] as unknown) = this.updateHelperPlist(
        this[plistKey],
        ...suffixArgs,
      );
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
        this[plistKey]!.CFBundleShortVersionString = this[
          plistKey
        ]!.CFBundleVersion = appVersionString;
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

    // Copying the icon compose icon mutates the appPlist so must
    // be run before we update plist files
    await this.copyIconComposerIcon(this.appPlist);

    await Promise.all(
      plists.map(([filename, varName]) =>
        promisifiedGracefulFs.writeFile(
          filename,
          plist.build(this[varName as PlistNames] as PlistValue),
        ),
      ),
    );
  }

  async moveHelpers() {
    const helpers = [
      ' Helper',
      ' Helper EH',
      ' Helper NP',
      ' Helper (Renderer)',
      ' Helper (Plugin)',
      ' Helper (GPU)',
    ];
    await Promise.all(
      helpers.map((suffix) => this.moveHelper(this.frameworksPath, suffix)),
    );
    if (fs.existsSync(this.loginItemsPath)) {
      await this.moveHelper(this.loginItemsPath, ' Login Helper');
    }
  }

  async moveHelper(helperDirectory: string, suffix: string) {
    const originalBasename = `Electron${suffix}`;

    if (fs.existsSync(path.join(helperDirectory, `${originalBasename}.app`))) {
      return this.renameHelperAndExecutable(
        helperDirectory,
        originalBasename,
        `${sanitizeAppName(this.appName)}${suffix}`,
      );
    } else {
      return Promise.resolve();
    }
  }

  async renameHelperAndExecutable(
    helperDirectory: string,
    originalBasename: string,
    newBasename: string,
  ) {
    const originalAppname = `${originalBasename}.app`;
    const executableBasePath = path.join(
      helperDirectory,
      originalAppname,
      'Contents',
      'MacOS',
    );
    await this.relativeRename(
      executableBasePath,
      originalBasename,
      newBasename,
    );
    await this.relativeRename(
      helperDirectory,
      originalAppname,
      `${newBasename}.app`,
    );
  }

  async copyIconComposerIcon(appPlist: NonNullable<Plists['appPlist']>) {
    if (!this.opts.icon) {
      return;
    }

    let iconComposerIcon: string | null = null;

    try {
      iconComposerIcon = (await this.normalizeIconExtension('.icon')) || null;
    } catch {
      // Ignore error if icon doesn't exist, in case only the .icns format was provided
    }
    if (iconComposerIcon) {
      debug(
        `Generating asset catalog for icon composer "${iconComposerIcon}" file`,
      );
      const assetCatalog = await generateAssetCatalogForIcon(iconComposerIcon);
      appPlist.CFBundleIconName = 'Icon';
      await promisifiedGracefulFs.writeFile(
        path.join(this.originalResourcesDir, 'Assets.car'),
        assetCatalog,
      );
    }
  }

  async copyIcon() {
    if (!this.opts.icon) {
      return Promise.resolve();
    }

    let icon: string | null = null;

    try {
      icon = (await this.normalizeIconExtension('.icns')) || null;
    } catch {
      // Ignore error if icon doesn't exist, in case it's only available for other OSes
    }
    if (icon) {
      debug(
        `Copying icon "${icon}" to app's Resources as "${this.appPlist!.CFBundleIconFile}"`,
      );
      await fs.promises.cp(
        icon,
        path.join(this.originalResourcesDir, this.appPlist!.CFBundleIconFile),
      );
    }
  }

  async renameAppAndHelpers() {
    await this.moveHelpers();
    await fs.promises.rename(this.electronAppPath, this.renamedAppPath);
  }

  /**
   * Sentinel string embedded in the Electron Framework binary, used as a marker
   * for the integrity digest storage location.
   * @see https://github.com/electron/electron/blob/2d5597b1b0fa697905380184e26c9f0947e05c5d/shell/common/asar/integrity_digest.mm#L24
   */
  static INTEGRITY_DIGEST_SENTINEL = 'AGbevlPCksUGKNL8TSn7wGmJEuJsXb2A';

  async setIntegrityDigest() {
    if (
      !this.opts.electronVersion ||
      !semver.valid(this.opts.electronVersion)
    ) {
      debug(
        `Cannot determine Electron version (got "${this.opts.electronVersion}"), skipping integrity digest`,
      );
      return;
    }
    if (!semver.gte(this.opts.electronVersion, '41.0.0-alpha.1')) {
      return;
    }

    const appPath = this.renamedAppPath ?? this.electronAppPath;
    let integrity = this.asarIntegrity;

    // For universal builds, asarIntegrity isn't set on the shell App instance.
    // Fall back to reading it from the merged app's Info.plist.
    if (!integrity || Object.keys(integrity).length === 0) {
      const plistPath = path.join(appPath, 'Contents', 'Info.plist');
      if (fs.existsSync(plistPath)) {
        try {
          const plistData = plist.parse(
            (await fs.promises.readFile(plistPath)).toString(),
          ) as PlistObject;
          if (isAsarIntegrity(plistData.ElectronAsarIntegrity)) {
            integrity = plistData.ElectronAsarIntegrity;
          }
        } catch (err) {
          warning(
            `Failed to read asar integrity from ${plistPath}: ${err}. The integrity digest will not be written.`,
            this.opts.quiet,
          );
          return;
        }
      }
    }

    if (!integrity || Object.keys(integrity).length === 0) {
      return;
    }
    const frameworkPath = path.join(
      appPath,
      'Contents',
      'Frameworks',
      'Electron Framework.framework',
      'Electron Framework',
    );
    if (!fs.existsSync(frameworkPath)) {
      warning(
        `Electron Framework binary not found at ${frameworkPath}. The asar integrity digest will not be written, which may cause runtime failures.`,
        this.opts.quiet,
      );
      return;
    }

    // Calculate v1 integrity digest: SHA256 over sorted (key, algorithm, hash) tuples
    // @see https://github.com/electron/electron/blob/2d5597b1b0fa697905380184e26c9f0947e05c5d/shell/common/asar/integrity_digest.mm#L52-L66
    const integrityHash = crypto.createHash('SHA256');
    for (const key of Object.keys(integrity).sort()) {
      const { algorithm, hash } = integrity[key];
      integrityHash.update(key);
      integrityHash.update(algorithm);
      integrityHash.update(hash);
    }
    const digest = integrityHash.digest();

    const sentinel = Buffer.from(MacApp.INTEGRITY_DIGEST_SENTINEL);
    await writeIntegrityDigest(frameworkPath, sentinel, digest, this.opts.quiet);
  }

  async signAppIfSpecified() {
    const osxSignOpt = this.opts.osxSign;
    const platform = this.opts.platform;
    const version = this.opts.electronVersion;

    if (platform === 'mas' && osxSignOpt === undefined) {
      warning(
        'signing is required for mas builds. Provide the osx-sign option, ' +
          'or manually sign the app later.',
        this.opts.quiet,
      );
    }

    if (osxSignOpt) {
      const signOpts = createSignOpts(
        osxSignOpt,
        platform,
        this.renamedAppPath,
        version,
        this.opts.quiet,
      );
      debug(
        `Running @electron/osx-sign with the options ${JSON.stringify(signOpts)}`,
      );
      try {
        await sign(signOpts);
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
    // Copying icons depends on the plist files being updated
    await this.copyIcon();
    await this.renameElectron();
    await this.renameAppAndHelpers();
    await this.copyExtraResources();
    await this.setIntegrityDigest();
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
export function filterCFBundleIdentifier(
  identifier: ProcessedOptionsWithSinglePlatformArch['appBundleId'],
) {
  return identifier!.replace(/ /g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
}

type Mutable<T> = {
  -readonly [key in keyof T]: T[key];
};

type CreateSignOptsResult = Mutable<
  SignOptions & {
    continueOnError?: boolean;
  }
>;

export function createSignOpts(
  properties: Exclude<
    ProcessedOptionsWithSinglePlatformArch['osxSign'],
    undefined
  >,
  platform: ProcessedOptionsWithSinglePlatformArch['platform'],
  app: string,
  version: ProcessedOptionsWithSinglePlatformArch['electronVersion'],
  quiet?: boolean,
): CreateSignOptsResult {
  // use default sign opts if osx-sign is true, otherwise clone osx-sign object
  const signOpts = (
    properties === true ? { identity: null } : { ...properties }
  ) as CreateSignOptsResult;

  if (typeof properties === 'object') {
    // osx-sign options are handed off to sign module, but
    // with a few additions from the main options
    // user may think they can pass platform, app, or version, but they will be ignored
    subOptionWarning(signOpts, 'osx-sign', 'platform', platform, quiet);
    subOptionWarning(signOpts, 'osx-sign', 'app', app, quiet);
    subOptionWarning(signOpts, 'osx-sign', 'version', version, quiet);

    if (signOpts.binaries) {
      warning(
        'osx-sign.binaries is not an allowed sub-option. Not passing to @electron/osx-sign.',
        quiet,
      );
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
  } else {
    return {
      identity: undefined,
      platform: platform as ElectronMacPlatform,
      app,
      version,
      continueOnError: true,
    };
  }
}

type CreateNotarizeOptsResult = Exclude<NotarizeOptions, { tool?: 'legacy' }>;

export function createNotarizeOpts(
  properties: ProcessedOptionsWithSinglePlatformArch['osxNotarize'],
  appBundleId: string,
  appPath: string,
  quiet: boolean,
): CreateNotarizeOptsResult {
  // osxNotarize options are handed off to the @electron/notarize module, but with a few
  // additions from the main options. The user may think they can pass appPath,
  // but it will be ignored.
  subOptionWarning(
    properties as unknown as Record<string, unknown>,
    'osxNotarize',
    'appPath',
    appPath,
    quiet,
  );
  return properties as CreateNotarizeOptsResult;
}
