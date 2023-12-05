"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packager = exports.Packager = void 0;
const common_1 = require("./common");
const copy_filter_1 = require("./copy-filter");
const download_1 = require("./download");
const fs_extra_1 = __importDefault(require("fs-extra"));
const infer_1 = require("./infer");
const hooks_1 = require("./hooks");
const path_1 = __importDefault(require("path"));
const targets_1 = require("./targets");
const unzip_1 = require("./unzip");
const universal_1 = require("./universal");
function debugHostInfo() {
    (0, common_1.debug)((0, common_1.hostInfo)());
}
class Packager {
    constructor(opts) {
        this.canCreateSymlinks = undefined;
        this.opts = opts;
        this.tempBase = (0, common_1.baseTempDir)(opts);
        this.useTempDir = opts.tmpdir !== false;
    }
    async ensureTempDir() {
        if (this.useTempDir) {
            await fs_extra_1.default.remove(this.tempBase);
        }
        else {
            return Promise.resolve();
        }
    }
    async testSymlink(comboOpts, zipPath) {
        await fs_extra_1.default.mkdirp(this.tempBase);
        const testPath = await fs_extra_1.default.mkdtemp(path_1.default.join(this.tempBase, `symlink-test-${comboOpts.platform}-${comboOpts.arch}-`));
        const testFile = path_1.default.join(testPath, 'test');
        const testLink = path_1.default.join(testPath, 'testlink');
        try {
            await fs_extra_1.default.outputFile(testFile, '');
            await fs_extra_1.default.symlink(testFile, testLink);
            this.canCreateSymlinks = true;
        }
        catch (e) {
            /* istanbul ignore next */
            this.canCreateSymlinks = false;
        }
        finally {
            await fs_extra_1.default.remove(testPath);
        }
        if (this.canCreateSymlinks) {
            return this.checkOverwrite(comboOpts, zipPath);
        }
        /* istanbul ignore next */
        return this.skipHostPlatformSansSymlinkSupport(comboOpts);
    }
    /* istanbul ignore next */
    skipHostPlatformSansSymlinkSupport(comboOpts) {
        (0, common_1.info)(`Cannot create symlinks (on Windows hosts, it requires admin privileges); skipping ${comboOpts.platform} platform`, this.opts.quiet);
        return Promise.resolve();
    }
    async overwriteAndCreateApp(outDir, comboOpts, zipPath) {
        (0, common_1.debug)(`Removing ${outDir} due to setting overwrite: true`);
        await fs_extra_1.default.remove(outDir);
        return this.createApp(comboOpts, zipPath);
    }
    async extractElectronZip(comboOpts, zipPath, buildDir) {
        (0, common_1.debug)(`Extracting ${zipPath} to ${buildDir}`);
        await (0, unzip_1.extractElectronZip)(zipPath, buildDir);
        await (0, hooks_1.promisifyHooks)(this.opts.afterExtract, [
            buildDir,
            comboOpts.electronVersion,
            comboOpts.platform,
            comboOpts.arch,
        ]);
    }
    async buildDir(platform, arch) {
        let buildParentDir;
        if (this.useTempDir) {
            buildParentDir = this.tempBase;
        }
        else {
            buildParentDir = this.opts.out || process.cwd();
        }
        await fs_extra_1.default.mkdirp(buildParentDir);
        return await fs_extra_1.default.mkdtemp(path_1.default.resolve(buildParentDir, `${platform}-${arch}-template-`));
    }
    async createApp(comboOpts, zipPath) {
        const buildDir = await this.buildDir(comboOpts.platform, comboOpts.arch);
        (0, common_1.info)(`Packaging app for platform ${comboOpts.platform} ${comboOpts.arch} using electron v${comboOpts.electronVersion}`, this.opts.quiet);
        (0, common_1.debug)(`Creating ${buildDir}`);
        await fs_extra_1.default.ensureDir(buildDir);
        await this.extractElectronZip(comboOpts, zipPath, buildDir);
        const os = await Promise.resolve(`${targets_1.osModules[comboOpts.platform]}`).then(s => __importStar(require(s)));
        const app = new os.App(comboOpts, buildDir);
        return app.create();
    }
    async checkOverwrite(comboOpts, zipPath) {
        const finalPath = (0, common_1.generateFinalPath)(comboOpts);
        if (await fs_extra_1.default.pathExists(finalPath)) {
            if (this.opts.overwrite) {
                return this.overwriteAndCreateApp(finalPath, comboOpts, zipPath);
            }
            else {
                (0, common_1.info)(`Skipping ${comboOpts.platform} ${comboOpts.arch} (output dir already exists, use --overwrite to force)`, this.opts.quiet);
                return true;
            }
        }
        else {
            return this.createApp(comboOpts, zipPath);
        }
    }
    async getElectronZipPath(downloadOpts) {
        if (this.opts.electronZipDir) {
            if (await fs_extra_1.default.pathExists(this.opts.electronZipDir)) {
                const zipPath = path_1.default.resolve(this.opts.electronZipDir, `electron-v${downloadOpts.version}-${downloadOpts.platform}-${downloadOpts.arch}.zip`);
                if (!await fs_extra_1.default.pathExists(zipPath)) {
                    throw new Error(`The specified Electron ZIP file does not exist: ${zipPath}`);
                }
                return zipPath;
            }
            throw new Error(`The specified Electron ZIP directory does not exist: ${this.opts.electronZipDir}`);
        }
        else {
            return (0, download_1.downloadElectronZip)(downloadOpts);
        }
    }
    async packageForPlatformAndArchWithOpts(comboOpts, downloadOpts) {
        const zipPath = await this.getElectronZipPath(downloadOpts);
        if (!this.useTempDir) {
            return this.createApp(comboOpts, zipPath);
        }
        if ((0, common_1.isPlatformMac)(comboOpts.platform)) {
            /* istanbul ignore else */
            if (this.canCreateSymlinks === undefined) {
                return this.testSymlink(comboOpts, zipPath);
            }
            else if (!this.canCreateSymlinks) {
                return this.skipHostPlatformSansSymlinkSupport(comboOpts);
            }
        }
        return this.checkOverwrite(comboOpts, zipPath);
    }
    async packageForPlatformAndArch(downloadOpts) {
        // Create delegated options object with specific platform and arch, for output directory naming
        const comboOpts = {
            ...this.opts,
            arch: downloadOpts.arch,
            platform: downloadOpts.platform,
            electronVersion: downloadOpts.version,
        };
        if ((0, common_1.isPlatformMac)(comboOpts.platform) && comboOpts.arch === 'universal') {
            return (0, universal_1.packageUniversalMac)(this.packageForPlatformAndArchWithOpts.bind(this), await this.buildDir(comboOpts.platform, comboOpts.arch), comboOpts, downloadOpts, this.tempBase);
        }
        return this.packageForPlatformAndArchWithOpts(comboOpts, downloadOpts);
    }
}
exports.Packager = Packager;
async function packageAllSpecifiedCombos(opts, archs, platforms) {
    const packager = new Packager(opts);
    await packager.ensureTempDir();
    return Promise.all((0, download_1.createDownloadCombos)(opts, platforms, archs).map(downloadOpts => packager.packageForPlatformAndArch(downloadOpts)));
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
async function packager(opts) {
    debugHostInfo();
    if (common_1.debug.enabled) {
        (0, common_1.debug)(`Packager Options: ${JSON.stringify(opts)}`);
    }
    const archs = (0, targets_1.validateListFromOptions)(opts, 'arch');
    const platforms = (0, targets_1.validateListFromOptions)(opts, 'platform');
    if (!Array.isArray(archs)) {
        return Promise.reject(archs);
    }
    if (!Array.isArray(platforms)) {
        return Promise.reject(platforms);
    }
    (0, common_1.debug)(`Target Platforms: ${platforms.join(', ')}`);
    (0, common_1.debug)(`Target Architectures: ${archs.join(', ')}`);
    const packageJSONDir = path_1.default.resolve(process.cwd(), opts.dir) || process.cwd();
    await (0, infer_1.getMetadataFromPackageJSON)(platforms, opts, packageJSONDir);
    if (opts.name?.endsWith(' Helper')) {
        throw new Error('Application names cannot end in " Helper" due to limitations on macOS');
    }
    (0, common_1.debug)(`Application name: ${opts.name}`);
    (0, common_1.debug)(`Target Electron version: ${opts.electronVersion}`);
    (0, copy_filter_1.populateIgnoredPaths)(opts);
    await (0, hooks_1.promisifyHooks)(opts.afterFinalizePackageTargets, [
        (0, targets_1.createPlatformArchPairs)(opts, platforms, archs).map(([platform, arch]) => ({ platform, arch })),
    ]);
    const appPaths = await packageAllSpecifiedCombos(opts, archs, platforms);
    // Remove falsy entries (e.g. skipped platforms)
    return appPaths.filter(appPath => appPath && typeof appPath === 'string');
}
exports.packager = packager;
//# sourceMappingURL=packager.js.map