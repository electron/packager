"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadElectronZip = exports.createDownloadCombos = exports.createDownloadOpts = void 0;
const common_1 = require("./common");
const get_1 = require("@electron/get");
const semver_1 = __importDefault(require("semver"));
const targets_1 = require("./targets");
function createDownloadOpts(opts, platform, arch) {
    const downloadOpts = { ...opts.download };
    (0, common_1.subOptionWarning)(downloadOpts, 'download', 'platform', platform, opts.quiet);
    (0, common_1.subOptionWarning)(downloadOpts, 'download', 'arch', arch, opts.quiet);
    (0, common_1.subOptionWarning)(downloadOpts, 'download', 'version', opts.electronVersion, opts.quiet);
    (0, common_1.subOptionWarning)(downloadOpts, 'download', 'artifactName', 'electron', opts.quiet);
    return downloadOpts;
}
exports.createDownloadOpts = createDownloadOpts;
function createDownloadCombos(opts, selectedPlatforms, selectedArchs, ignoreFunc) {
    const platformArchPairs = (0, targets_1.createPlatformArchPairs)(opts, selectedPlatforms, selectedArchs, ignoreFunc);
    return platformArchPairs.map(([platform, arch]) => {
        return createDownloadOpts(opts, platform, arch);
    });
}
exports.createDownloadCombos = createDownloadCombos;
async function downloadElectronZip(downloadOpts) {
    // armv7l builds have only been backfilled for Electron >= 1.0.0.
    // See: https://github.com/electron/electron/pull/6986
    /* istanbul ignore if */
    if (downloadOpts.arch === 'armv7l' && semver_1.default.lt(downloadOpts.version, '1.0.0')) {
        downloadOpts.arch = 'arm';
    }
    (0, common_1.debug)(`Downloading Electron with options ${JSON.stringify(downloadOpts)}`);
    return (0, get_1.downloadArtifact)(downloadOpts);
}
exports.downloadElectronZip = downloadElectronZip;
//# sourceMappingURL=download.js.map