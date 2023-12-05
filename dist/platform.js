"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const asar_1 = __importDefault(require("@electron/asar"));
const common_1 = require("./common");
const copy_filter_1 = require("./copy-filter");
const hooks_1 = require("./hooks");
const crypto_1 = __importDefault(require("crypto"));
class App {
    constructor(opts, templatePath) {
        this.asarIntegrity = undefined;
        this.cachedStagingPath = undefined;
        this.opts = opts;
        this.templatePath = templatePath;
        this.asarOptions = (0, common_1.createAsarOpts)(opts);
        if (this.opts.prune === undefined) {
            this.opts.prune = true;
        }
    }
    async create() {
        /* istanbul ignore next */
        throw new Error('Child classes must implement this');
    }
    /**
     * Resource directory path before renaming.
     */
    get originalResourcesDir() {
        return this.resourcesDir;
    }
    /**
     * Resource directory path after renaming.
     */
    get resourcesDir() {
        return path_1.default.join(this.stagingPath, 'resources');
    }
    get originalResourcesAppDir() {
        return path_1.default.join(this.originalResourcesDir, 'app');
    }
    get electronBinaryDir() {
        return this.stagingPath;
    }
    get originalElectronName() {
        /* istanbul ignore next */
        throw new Error('Child classes must implement this');
    }
    get newElectronName() {
        /* istanbul ignore next */
        throw new Error('Child classes must implement this');
    }
    get executableName() {
        return this.opts.executableName || this.opts.name;
    }
    get stagingPath() {
        if (this.opts.tmpdir === false) {
            return (0, common_1.generateFinalPath)(this.opts);
        }
        else {
            if (!this.cachedStagingPath) {
                const tempDir = (0, common_1.baseTempDir)(this.opts);
                fs_extra_1.default.mkdirpSync(tempDir);
                this.cachedStagingPath = fs_extra_1.default.mkdtempSync(path_1.default.resolve(tempDir, 'tmp-'));
            }
            return this.cachedStagingPath;
        }
    }
    get appAsarPath() {
        return path_1.default.join(this.originalResourcesDir, 'app.asar');
    }
    get commonHookArgs() {
        return [
            this.opts.electronVersion,
            this.opts.platform,
            this.opts.arch,
        ];
    }
    get hookArgsWithOriginalResourcesAppDir() {
        return [
            this.originalResourcesAppDir,
            ...this.commonHookArgs,
        ];
    }
    async relativeRename(basePath, oldName, newName) {
        (0, common_1.debug)(`Renaming ${oldName} to ${newName} in ${basePath}`);
        await fs_extra_1.default.rename(path_1.default.join(basePath, oldName), path_1.default.join(basePath, newName));
    }
    async renameElectron() {
        return this.relativeRename(this.electronBinaryDir, this.originalElectronName, this.newElectronName);
    }
    /**
     * Performs the following initial operations for an app:
     * * Creates temporary directory
     * * Remove default_app (which is either a folder or an asar file)
     * * If a prebuilt asar is specified:
     *   * Copies asar into temporary directory as app.asar
     * * Otherwise:
     *   * Copies template into temporary directory
     *   * Copies user's app into temporary directory
     *   * Prunes non-production node_modules (if opts.prune is either truthy or undefined)
     *   * Creates an asar (if opts.asar is set)
     *
     * Prune and asar are performed before platform-specific logic, primarily so that
     * this.originalResourcesAppDir is predictable (e.g. before .app is renamed for Mac)
     */
    async initialize() {
        (0, common_1.debug)(`Initializing app in ${this.stagingPath} from ${this.templatePath} template`);
        await fs_extra_1.default.move(this.templatePath, this.stagingPath, { overwrite: true });
        await this.removeDefaultApp();
        if (this.opts.prebuiltAsar) {
            await this.copyPrebuiltAsar();
        }
        else {
            await this.buildApp();
        }
        await (0, hooks_1.promisifyHooks)(this.opts.afterInitialize, this.hookArgsWithOriginalResourcesAppDir);
    }
    async buildApp() {
        await this.copyTemplate();
        await (0, common_1.validateElectronApp)(this.opts.dir, this.originalResourcesAppDir);
        await this.asarApp();
    }
    async copyTemplate() {
        await (0, hooks_1.promisifyHooks)(this.opts.beforeCopy, this.hookArgsWithOriginalResourcesAppDir);
        await fs_extra_1.default.copy(this.opts.dir, this.originalResourcesAppDir, {
            filter: (0, copy_filter_1.userPathFilter)(this.opts),
            dereference: this.opts.derefSymlinks,
        });
        await (0, hooks_1.promisifyHooks)(this.opts.afterCopy, this.hookArgsWithOriginalResourcesAppDir);
        if (this.opts.prune) {
            await (0, hooks_1.promisifyHooks)(this.opts.afterPrune, this.hookArgsWithOriginalResourcesAppDir);
        }
    }
    async removeDefaultApp() {
        await Promise.all([
            'default_app',
            'default_app.asar',
        ].map(async (basename) => fs_extra_1.default.remove(path_1.default.join(this.originalResourcesDir, basename))));
    }
    /**
     * Forces an icon filename to a given extension and returns the normalized filename,
     * if it exists.  Otherwise, returns null.
     *
     * This error path is used by win32 if no icon is specified.
     */
    async normalizeIconExtension(targetExt) {
        if (!this.opts.icon) {
            throw new Error('No filename specified to normalizeIconExtension');
        }
        let iconFilename = this.opts.icon;
        const ext = path_1.default.extname(iconFilename);
        if (ext !== targetExt) {
            iconFilename = path_1.default.join(path_1.default.dirname(iconFilename), path_1.default.basename(iconFilename, ext) + targetExt);
        }
        if (await fs_extra_1.default.pathExists(iconFilename)) {
            return iconFilename;
        }
        else {
            /* istanbul ignore next */
            (0, common_1.warning)(`Could not find icon "${iconFilename}", not updating app icon`, this.opts.quiet);
        }
    }
    prebuiltAsarWarning(option, triggerWarning) {
        if (triggerWarning) {
            (0, common_1.warning)(`prebuiltAsar and ${option} are incompatible, ignoring the ${option} option`, this.opts.quiet);
        }
    }
    async copyPrebuiltAsar() {
        if (this.asarOptions) {
            (0, common_1.warning)('prebuiltAsar has been specified, all asar options will be ignored', this.opts.quiet);
        }
        for (const hookName of ['beforeCopy', 'afterCopy', 'afterPrune']) {
            if (this.opts[hookName]) {
                throw new Error(`${hookName} is incompatible with prebuiltAsar`);
            }
        }
        this.prebuiltAsarWarning('ignore', this.opts.originalIgnore);
        this.prebuiltAsarWarning('prune', !this.opts.prune);
        this.prebuiltAsarWarning('derefSymlinks', this.opts.derefSymlinks !== undefined);
        const src = path_1.default.resolve(this.opts.prebuiltAsar);
        const stat = await fs_extra_1.default.stat(src);
        if (!stat.isFile()) {
            throw new Error(`${src} specified in prebuiltAsar must be an asar file.`);
        }
        (0, common_1.debug)(`Copying asar: ${src} to ${this.appAsarPath}`);
        await fs_extra_1.default.copy(src, this.appAsarPath, { overwrite: false, errorOnExist: true });
    }
    appRelativePath(p) {
        return path_1.default.relative(this.stagingPath, p);
    }
    async asarApp() {
        if (!this.asarOptions) {
            return Promise.resolve();
        }
        (0, common_1.debug)(`Running asar with the options ${JSON.stringify(this.asarOptions)}`);
        await (0, hooks_1.promisifyHooks)(this.opts.beforeAsar, this.hookArgsWithOriginalResourcesAppDir);
        await asar_1.default.createPackageWithOptions(this.originalResourcesAppDir, this.appAsarPath, this.asarOptions);
        const { headerString } = asar_1.default.getRawHeader(this.appAsarPath);
        this.asarIntegrity = {
            [this.appRelativePath(this.appAsarPath)]: {
                algorithm: 'SHA256',
                hash: crypto_1.default.createHash('SHA256').update(headerString).digest('hex'),
            },
        };
        await fs_extra_1.default.remove(this.originalResourcesAppDir);
        await (0, hooks_1.promisifyHooks)(this.opts.afterAsar, this.hookArgsWithOriginalResourcesAppDir);
    }
    async copyExtraResources() {
        if (!this.opts.extraResource) {
            return Promise.resolve();
        }
        const extraResources = (0, common_1.ensureArray)(this.opts.extraResource);
        const hookArgs = [
            this.stagingPath,
            ...this.commonHookArgs,
        ];
        await (0, hooks_1.promisifyHooks)(this.opts.beforeCopyExtraResources, hookArgs);
        await Promise.all(extraResources.map(resource => fs_extra_1.default.copy(resource, path_1.default.resolve(this.stagingPath, this.resourcesDir, path_1.default.basename(resource)))));
        await (0, hooks_1.promisifyHooks)(this.opts.afterCopyExtraResources, hookArgs);
    }
    async move() {
        const finalPath = (0, common_1.generateFinalPath)(this.opts);
        if (this.opts.tmpdir !== false) {
            (0, common_1.debug)(`Moving ${this.stagingPath} to ${finalPath}`);
            await fs_extra_1.default.move(this.stagingPath, finalPath);
        }
        if (this.opts.afterComplete) {
            const hookArgs = [
                finalPath,
                ...this.commonHookArgs,
            ];
            await (0, hooks_1.promisifyHooks)(this.opts.afterComplete, hookArgs);
        }
        return finalPath;
    }
}
exports.App = App;
//# sourceMappingURL=platform.js.map