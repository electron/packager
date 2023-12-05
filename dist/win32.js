"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = exports.WindowsApp = exports.updateWineMissingException = void 0;
const path_1 = __importDefault(require("path"));
const cross_spawn_windows_exe_1 = require("cross-spawn-windows-exe");
const windows_sign_1 = require("@electron/windows-sign");
const platform_1 = require("./platform");
const common_1 = require("./common");
const rcedit_1 = __importDefault(require("rcedit"));
function updateWineMissingException(err) {
    if (err instanceof cross_spawn_windows_exe_1.WrapperError) {
        err.message += '\n\n' +
            'Wine is required to use the appCopyright, appVersion, buildVersion, icon, and \n' +
            'win32metadata parameters for Windows targets.\n\n' +
            'See https://github.com/electron/packager#building-windows-apps-from-non-windows-platforms for details.';
    }
    return err;
}
exports.updateWineMissingException = updateWineMissingException;
class WindowsApp extends platform_1.App {
    get originalElectronName() {
        return 'electron.exe';
    }
    get newElectronName() {
        return `${(0, common_1.sanitizeAppName)(this.executableName)}.exe`;
    }
    get electronBinaryPath() {
        return path_1.default.join(this.stagingPath, this.newElectronName);
    }
    generateRceditOptionsSansIcon() {
        const win32metadata = {
            FileDescription: this.opts.name,
            InternalName: this.opts.name,
            OriginalFilename: this.newElectronName,
            ProductName: this.opts.name,
            ...this.opts.win32metadata,
        };
        const rcOpts = { 'version-string': win32metadata };
        if (this.opts.appVersion) {
            rcOpts['product-version'] = rcOpts['file-version'] = this.opts.appVersion;
        }
        if (this.opts.buildVersion) {
            rcOpts['file-version'] = this.opts.buildVersion;
        }
        if (this.opts.appCopyright) {
            rcOpts['version-string'].LegalCopyright = this.opts.appCopyright;
        }
        const manifestProperties = ['application-manifest', 'requested-execution-level'];
        for (const manifestProperty of manifestProperties) {
            if (win32metadata[manifestProperty]) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                rcOpts[manifestProperty] = win32metadata[manifestProperty];
            }
        }
        return rcOpts;
    }
    async getIconPath() {
        if (!this.opts.icon) {
            return Promise.resolve();
        }
        return this.normalizeIconExtension('.ico');
    }
    needsRcedit() {
        return Boolean(this.opts.icon || this.opts.win32metadata || this.opts.appCopyright || this.opts.appVersion || this.opts.buildVersion);
    }
    async runRcedit() {
        /* istanbul ignore if */
        if (!this.needsRcedit()) {
            return Promise.resolve();
        }
        const rcOpts = this.generateRceditOptionsSansIcon();
        // Icon might be omitted or only exist in one OS's format, so skip it if normalizeExt reports an error
        const icon = await this.getIconPath();
        if (icon) {
            rcOpts.icon = icon;
        }
        (0, common_1.debug)(`Running rcedit with the options ${JSON.stringify(rcOpts)}`);
        try {
            await (0, rcedit_1.default)(this.electronBinaryPath, rcOpts);
        }
        catch (err) {
            throw updateWineMissingException(err);
        }
    }
    async signAppIfSpecified() {
        const windowsSignOpt = this.opts.windowsSign;
        const windowsMetaData = this.opts.win32metadata;
        if (windowsSignOpt) {
            const signOpts = createSignOpts(windowsSignOpt, windowsMetaData);
            (0, common_1.debug)(`Running @electron/windows-sign with the options ${JSON.stringify(signOpts)}`);
            try {
                await (0, windows_sign_1.sign)(signOpts);
            }
            catch (err) {
                // Although not signed successfully, the application is packed.
                if (signOpts.continueOnError) {
                    (0, common_1.warning)(`Code sign failed; please retry manually. ${err}`, this.opts.quiet);
                }
                else {
                    throw err;
                }
            }
        }
    }
    async create() {
        await this.initialize();
        await this.renameElectron();
        await this.copyExtraResources();
        await this.runRcedit();
        await this.signAppIfSpecified();
        return this.move();
    }
}
exports.WindowsApp = WindowsApp;
exports.App = WindowsApp;
function createSignOpts(properties, windowsMetaData) {
    let result = {};
    if (typeof properties === 'object') {
        result = { ...properties };
    }
    // A little bit of convenience
    if (windowsMetaData && windowsMetaData.FileDescription && !result.description) {
        result.description = windowsMetaData.FileDescription;
    }
    return result;
}
//# sourceMappingURL=win32.js.map