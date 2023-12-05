import { IgnoreFunc, OfficialPlatform, Options, SupportedArch, SupportedPlatform } from './types';
export declare const officialArchs: string[];
export declare const officialPlatforms: string[];
export declare const officialPlatformArchCombos: Record<SupportedPlatform, SupportedArch[]>;
export declare const osModules: Record<OfficialPlatform, string>;
export declare const supported: {
    arch: Set<string>;
    platform: Set<string>;
};
export declare function createPlatformArchPairs(opts: Options, selectedPlatforms: SupportedPlatform[], selectedArchs: SupportedArch[], ignoreFunc?: IgnoreFunc): [SupportedPlatform, SupportedArch][];
export declare function allOfficialArchsForPlatformAndVersion(platform: SupportedPlatform, electronVersion: Options['electronVersion']): SupportedArch[];
export declare function validateListFromOptions(opts: Options, name: keyof typeof supported): Error | string[];
