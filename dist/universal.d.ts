import { ComboOptions, DownloadOptions } from './types';
import { Packager } from './packager';
export declare function packageUniversalMac(packageForPlatformAndArchWithOpts: Packager['packageForPlatformAndArchWithOpts'], buildDir: string, comboOpts: ComboOptions, downloadOpts: DownloadOptions, tempBase: string): Promise<string | true>;
