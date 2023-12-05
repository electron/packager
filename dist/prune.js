"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isModule = exports.Pruner = void 0;
const common_1 = require("./common");
const galactus_1 = require("galactus");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const ELECTRON_MODULES = [
    'electron',
    'electron-nightly'
];
class Pruner {
    constructor(dir, quiet) {
        this.modules = new Set();
        this.walkedTree = false;
        this.baseDir = (0, common_1.normalizePath)(dir);
        this.quiet = quiet;
        this.galactus = new galactus_1.DestroyerOfModules({
            rootDirectory: dir,
            shouldKeepModuleTest: (module, isDevDep) => this.shouldKeepModule(module, isDevDep)
        });
    }
    setModules(moduleMap) {
        const modulePaths = Array.from(moduleMap.keys()).map(modulePath => `/${(0, common_1.normalizePath)(modulePath)}`);
        this.modules = new Set(modulePaths);
        this.walkedTree = true;
    }
    async pruneModule(name) {
        if (this.walkedTree) {
            return this.isProductionModule(name);
        }
        else {
            const moduleMap = await this.galactus.collectKeptModules({ relativePaths: true });
            this.setModules(moduleMap);
            return this.isProductionModule(name);
        }
    }
    shouldKeepModule(module, isDevDep) {
        if (isDevDep || module.depType === galactus_1.DepType.ROOT) {
            return false;
        }
        if (ELECTRON_MODULES.includes(module.name)) {
            (0, common_1.warning)(`Found '${module.name}' but not as a devDependency, pruning anyway`, this.quiet);
            return false;
        }
        return true;
    }
    isProductionModule(name) {
        return this.modules.has(name);
    }
}
exports.Pruner = Pruner;
function isNodeModuleFolder(pathToCheck) {
    return path_1.default.basename(path_1.default.dirname(pathToCheck)) === 'node_modules' ||
        (path_1.default.basename(path_1.default.dirname(pathToCheck)).startsWith('@') && path_1.default.basename(path_1.default.resolve(pathToCheck, `..${path_1.default.sep}..`)) === 'node_modules');
}
async function isModule(pathToCheck) {
    return (await fs_extra_1.default.pathExists(path_1.default.join(pathToCheck, 'package.json'))) && isNodeModuleFolder(pathToCheck);
}
exports.isModule = isModule;
//# sourceMappingURL=prune.js.map