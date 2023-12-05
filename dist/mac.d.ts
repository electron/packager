/// <reference types="node" />
import { App } from './platform';
import plist from 'plist';
import { NotarizeOptions } from '@electron/notarize';
import { ComboOptions } from './types';
import { SignOptions } from '@electron/osx-sign/dist/cjs/types';
type NSUsageDescription = {
    [key in `NS${string}UsageDescription`]: string;
};
type BasePList = {
    CFBundleDisplayName: string;
    CFBundleExecutable: string;
    CFBundleIdentifier: string | undefined;
    CFBundleName: string;
    CFBundleShortVersionString: string;
    CFBundleVersion: string;
} & NSUsageDescription;
interface Plists {
    appPlist?: (BasePList & {
        CFBundleIconFile: string;
        CFBundleURLTypes: MacApp['protocols'];
        ElectronAsarIntegrity: App['asarIntegrity'];
        LSApplicationCategoryType: string;
        NSHumanReadableCopyright: string;
        NSRequiresAquaSystemAppearance: boolean;
    });
    helperEHPlist?: BasePList;
    helperGPUPlist?: BasePList;
    helperNPPlist?: BasePList;
    helperPlist?: BasePList;
    helperPluginPlist?: BasePList;
    helperRendererPlist?: BasePList;
    loginHelperPlist?: BasePList;
}
type PlistNames = keyof Plists;
type LoadPlistParams = Parameters<MacApp['loadPlist']>;
export declare class MacApp extends App implements Plists {
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
    constructor(opts: ComboOptions, templatePath: string);
    get appCategoryType(): string | undefined;
    get appCopyright(): string | undefined;
    get appVersion(): string | undefined;
    get buildVersion(): string | undefined;
    get enableDarkMode(): boolean | undefined;
    get usageDescription(): {
        [property: string]: string;
    } | undefined;
    get protocols(): {
        CFBundleURLName: string;
        CFBundleURLSchemes: string[];
    }[];
    get dotAppName(): string;
    get defaultBundleName(): string;
    get bundleName(): string;
    get originalResourcesDir(): string;
    get resourcesDir(): string;
    get electronBinaryDir(): string;
    get originalElectronName(): string;
    get newElectronName(): string;
    get renamedAppPath(): string;
    get electronAppPath(): string;
    get contentsPath(): string;
    get frameworksPath(): string;
    get loginItemsPath(): string;
    get loginHelperPath(): string;
    updatePlist<T extends BasePList = BasePList>(basePlist: T, displayName: string, identifier: string | undefined, name: string): T;
    updateHelperPlist(helperPlist: MacApp['helperPlist'], suffix?: string, identifierIgnoresSuffix?: boolean): BasePList;
    extendPlist(basePlist: BasePList, propsOrFilename: ComboOptions['extendInfo' | 'extendHelperInfo']): Promise<void | ({
        CFBundleDisplayName: string;
        CFBundleExecutable: string;
        CFBundleIdentifier: string | undefined;
        CFBundleName: string;
        CFBundleShortVersionString: string;
        CFBundleVersion: string;
    } & NSUsageDescription & string) | ({
        CFBundleDisplayName: string;
        CFBundleExecutable: string;
        CFBundleIdentifier: string | undefined;
        CFBundleName: string;
        CFBundleShortVersionString: string;
        CFBundleVersion: string;
    } & NSUsageDescription & number) | ({
        CFBundleDisplayName: string;
        CFBundleExecutable: string;
        CFBundleIdentifier: string | undefined;
        CFBundleName: string;
        CFBundleShortVersionString: string;
        CFBundleVersion: string;
    } & NSUsageDescription & false) | ({
        CFBundleDisplayName: string;
        CFBundleExecutable: string;
        CFBundleIdentifier: string | undefined;
        CFBundleName: string;
        CFBundleShortVersionString: string;
        CFBundleVersion: string;
    } & NSUsageDescription & true) | ({
        CFBundleDisplayName: string;
        CFBundleExecutable: string;
        CFBundleIdentifier: string | undefined;
        CFBundleName: string;
        CFBundleShortVersionString: string;
        CFBundleVersion: string;
    } & NSUsageDescription & Buffer) | ({
        CFBundleDisplayName: string;
        CFBundleExecutable: string;
        CFBundleIdentifier: string | undefined;
        CFBundleName: string;
        CFBundleShortVersionString: string;
        CFBundleVersion: string;
    } & NSUsageDescription & Date) | ({
        CFBundleDisplayName: string;
        CFBundleExecutable: string;
        CFBundleIdentifier: string | undefined;
        CFBundleName: string;
        CFBundleShortVersionString: string;
        CFBundleVersion: string;
    } & NSUsageDescription & plist.PlistArray) | ({
        CFBundleDisplayName: string;
        CFBundleExecutable: string;
        CFBundleIdentifier: string | undefined;
        CFBundleName: string;
        CFBundleShortVersionString: string;
        CFBundleVersion: string;
    } & NSUsageDescription & {
        [property: string]: any;
    })>;
    loadPlist(filename: string, propName?: PlistNames): Promise<plist.PlistValue>;
    ehPlistFilename(helper: string): string;
    helperPlistFilename(helperApp: string): string;
    determinePlistFilesToUpdate(): Promise<LoadPlistParams[]>;
    appRelativePath(p: string): string;
    updatePlistFiles(): Promise<void>;
    moveHelpers(): Promise<void>;
    moveHelper(helperDirectory: string, suffix: string): Promise<void>;
    renameHelperAndExecutable(helperDirectory: string, originalBasename: string, newBasename: string): Promise<void>;
    copyIcon(): Promise<void>;
    renameAppAndHelpers(): Promise<void>;
    signAppIfSpecified(): Promise<void>;
    notarizeAppIfSpecified(): Promise<void>;
    create(): Promise<string>;
}
export { MacApp as App };
/**
 * Remove special characters and allow only alphanumeric (A-Z,a-z,0-9), hyphen (-), and period (.)
 * Apple documentation:
 * https://developer.apple.com/library/mac/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html#//apple_ref/doc/uid/20001431-102070
 */
export declare function filterCFBundleIdentifier(identifier: ComboOptions['appBundleId']): string;
type Mutable<T> = {
    -readonly [key in keyof T]: T[key];
};
type CreateSignOptsResult = Mutable<SignOptions & {
    continueOnError?: boolean;
}>;
export declare function createSignOpts(properties: ComboOptions['osxSign'], platform: ComboOptions['platform'], app: string, version: ComboOptions['electronVersion'], quiet?: boolean): CreateSignOptsResult;
export declare function createNotarizeOpts(properties: ComboOptions['osxNotarize'], appBundleId: string, appPath: string, quiet: boolean): NotarizeOptions;
