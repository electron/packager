"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageUniversalMac = void 0;
const universal_1 = require("@electron/universal");
const common_1 = require("./common");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const mac_1 = require("./mac");
async function packageUniversalMac(packageForPlatformAndArchWithOpts, buildDir, comboOpts, downloadOpts, tempBase) {
    // In order to generate a universal macOS build we actually need to build the x64 and the arm64 app
    // and then glue them together
    (0, common_1.info)(`Packaging app for platform ${comboOpts.platform} universal using electron v${comboOpts.electronVersion} - Building x64 and arm64 slices now`, comboOpts.quiet);
    await fs_extra_1.default.mkdirp(tempBase);
    const tempDir = await fs_extra_1.default.mkdtemp(path_1.default.resolve(tempBase, 'electron-packager-universal-'));
    const app = new mac_1.App(comboOpts, buildDir);
    const universalStagingPath = app.stagingPath;
    const finalUniversalPath = (0, common_1.generateFinalPath)(app.opts);
    if (await fs_extra_1.default.pathExists(finalUniversalPath)) {
        if (comboOpts.overwrite) {
            await fs_extra_1.default.remove(finalUniversalPath);
        }
        else {
            (0, common_1.info)(`Skipping ${comboOpts.platform} ${comboOpts.arch} (output dir already exists, use --overwrite to force)`, comboOpts.quiet);
            return true;
        }
    }
    const tempPackages = {};
    await Promise.all(['x64', 'arm64'].map(async (tempArch) => {
        const tempOpts = {
            ...comboOpts,
            arch: tempArch,
            out: tempDir,
        };
        const tempDownloadOpts = {
            ...downloadOpts,
            arch: tempArch,
        };
        // Do not sign or notarize the individual slices, we sign and notarize the merged app later
        delete tempOpts.osxSign;
        delete tempOpts.osxNotarize;
        // @TODO(erikian): I don't like this type cast, the return type for `packageForPlatformAndArchWithOpts` is probably wrong
        tempPackages[tempArch] = (await packageForPlatformAndArchWithOpts(tempOpts, tempDownloadOpts));
    }));
    const x64AppPath = tempPackages.x64;
    const arm64AppPath = tempPackages.arm64;
    (0, common_1.info)(`Stitching universal app for platform ${comboOpts.platform}`, comboOpts.quiet);
    const generatedFiles = await fs_extra_1.default.readdir(x64AppPath);
    const appName = generatedFiles.filter(file => path_1.default.extname(file) === '.app')[0];
    await (0, universal_1.makeUniversalApp)({
        ...comboOpts.osxUniversal,
        x64AppPath: path_1.default.resolve(x64AppPath, appName),
        arm64AppPath: path_1.default.resolve(arm64AppPath, appName),
        outAppPath: path_1.default.resolve(universalStagingPath, appName),
        force: false,
    });
    await app.signAppIfSpecified();
    await app.notarizeAppIfSpecified();
    await app.move();
    for (const generatedFile of generatedFiles) {
        if (path_1.default.extname(generatedFile) === '.app') {
            continue;
        }
        await fs_extra_1.default.copy(path_1.default.resolve(x64AppPath, generatedFile), path_1.default.resolve(finalUniversalPath, generatedFile));
    }
    await fs_extra_1.default.remove(tempDir);
    return finalUniversalPath;
}
exports.packageUniversalMac = packageUniversalMac;
//# sourceMappingURL=universal.js.map