import { ComboOptions, DownloadOptions, Options } from './types';
export declare class Packager {
    canCreateSymlinks: boolean | undefined;
    opts: Options;
    tempBase: string;
    useTempDir: boolean;
    constructor(opts: Options);
    ensureTempDir(): Promise<void>;
    testSymlink(comboOpts: ComboOptions, zipPath: string): Promise<string | true | void>;
    skipHostPlatformSansSymlinkSupport(comboOpts: ComboOptions): Promise<void>;
    overwriteAndCreateApp(outDir: string, comboOpts: ComboOptions, zipPath: string): Promise<string>;
    extractElectronZip(comboOpts: ComboOptions, zipPath: string, buildDir: string): Promise<void>;
    buildDir(platform: ComboOptions['platform'], arch: ComboOptions['arch']): Promise<string>;
    createApp(comboOpts: ComboOptions, zipPath: string): Promise<string>;
    checkOverwrite(comboOpts: ComboOptions, zipPath: string): Promise<string | true>;
    getElectronZipPath(downloadOpts: DownloadOptions): Promise<string>;
    packageForPlatformAndArchWithOpts(comboOpts: ComboOptions, downloadOpts: DownloadOptions): Promise<string | true | void>;
    packageForPlatformAndArch(downloadOpts: DownloadOptions): Promise<string | true | void>;
}
/**
 * Bundles Electron-based application source code with a renamed/customized Electron executable and
 * its supporting files into folders ready for distribution.
 *
 * Briefly, this function:
 * - finds or downloads the correct release of Electron
 * - uses that version of Electron to create a app in `<out>/<appname>-<platform>-<arch>`
 *
 * Short example:
 *
 * ```javascript
 * const packager = require('@electron/packager')
 *
 * async function bundleElectronApp(options) {
 *   const appPaths = await packager(options)
 *   console.log(`Electron app bundles created:\n${appPaths.join("\n")}`)
 * }
 * ```
 *
 * @param opts - Options to configure packaging.
 *
 * @returns A Promise containing the paths to the newly created application bundles.
 */
export declare function packager(opts: Options): Promise<string[]>;
