import { DownloadOptions, IgnoreFunc, Options, SupportedArch, SupportedPlatform } from './types';
export declare function createDownloadOpts(opts: Options, platform: SupportedPlatform, arch: SupportedArch): DownloadOptions;
export declare function createDownloadCombos(opts: Options, selectedPlatforms: SupportedPlatform[], selectedArchs: SupportedArch[], ignoreFunc?: IgnoreFunc): DownloadOptions[];
export declare function downloadElectronZip(downloadOpts: DownloadOptions): Promise<string>;
