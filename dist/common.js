"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hostInfo = exports.validateElectronApp = exports.normalizePath = exports.baseTempDir = exports.isPlatformMac = exports.ensureArray = exports.createAsarOpts = exports.subOptionWarning = exports.warning = exports.info = exports.generateFinalPath = exports.generateFinalBasename = exports.sanitizeAppName = exports.debug = void 0;
const filenamify_1 = __importDefault(require("filenamify"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("debug"));
exports.debug = (0, debug_1.default)('electron-packager');
function sanitizeAppName(name) {
    return (0, filenamify_1.default)(name, { replacement: '-' });
}
exports.sanitizeAppName = sanitizeAppName;
function generateFinalBasename(opts) {
    return `${sanitizeAppName(opts.name)}-${opts.platform}-${opts.arch}`;
}
exports.generateFinalBasename = generateFinalBasename;
function generateFinalPath(opts) {
    return path_1.default.join(opts.out || process.cwd(), generateFinalBasename(opts));
}
exports.generateFinalPath = generateFinalPath;
function info(message, quiet) {
    if (!quiet) {
        console.info(message);
    }
}
exports.info = info;
function warning(message, quiet) {
    if (!quiet) {
        console.warn(`WARNING: ${message}`);
    }
}
exports.warning = warning;
function subOptionWarning(properties, optionName, parameter, value, quiet) {
    if (Object.prototype.hasOwnProperty.call(properties, parameter)) {
        warning(`${optionName}.${parameter} will be inferred from the main options`, quiet);
    }
    properties[parameter] = value;
}
exports.subOptionWarning = subOptionWarning;
function createAsarOpts(opts) {
    let asarOptions;
    if (opts.asar === true) {
        asarOptions = {};
    }
    else if (typeof opts.asar === 'object') {
        asarOptions = opts.asar;
    }
    else if (opts.asar === false || opts.asar === undefined) {
        return false;
    }
    else {
        warning(`asar parameter set to an invalid value (${opts.asar}), ignoring and disabling asar`, opts.quiet);
        return false;
    }
    return asarOptions;
}
exports.createAsarOpts = createAsarOpts;
function ensureArray(value) {
    return Array.isArray(value) ? value : [value];
}
exports.ensureArray = ensureArray;
function isPlatformMac(platform) {
    return platform === 'darwin' || platform === 'mas';
}
exports.isPlatformMac = isPlatformMac;
function baseTempDir(opts) {
    return path_1.default.join(opts.tmpdir || os_1.default.tmpdir(), 'electron-packager');
}
exports.baseTempDir = baseTempDir;
/**
 * Convert slashes to UNIX-format separators.
 */
function normalizePath(pathToNormalize) {
    return pathToNormalize.replace(/\\/g, '/');
}
exports.normalizePath = normalizePath;
/**
 * Validates that the application directory contains a package.json file, and that there exists an
 * appropriate main entry point file, per the rules of the "main" field in package.json.
 *
 * See: https://docs.npmjs.com/cli/v6/configuring-npm/package-json#main
 *
 * @param appDir - the directory specified by the user
 * @param bundledAppDir - the directory where the appDir is copied to in the bundled Electron app
 */
async function validateElectronApp(appDir, bundledAppDir) {
    (0, exports.debug)('Validating bundled Electron app');
    (0, exports.debug)('Checking for a package.json file');
    const bundledPackageJSONPath = path_1.default.join(bundledAppDir, 'package.json');
    if (!(await fs_extra_1.default.pathExists(bundledPackageJSONPath))) {
        const originalPackageJSONPath = path_1.default.join(appDir, 'package.json');
        throw new Error(`Application manifest was not found. Make sure "${originalPackageJSONPath}" exists and does not get ignored by your ignore option`);
    }
    (0, exports.debug)('Checking for the main entry point file');
    const packageJSON = await fs_extra_1.default.readJson(bundledPackageJSONPath);
    const mainScriptBasename = packageJSON.main || 'index.js';
    const mainScript = path_1.default.resolve(bundledAppDir, mainScriptBasename);
    if (!(await fs_extra_1.default.pathExists(mainScript))) {
        const originalMainScript = path_1.default.join(appDir, mainScriptBasename);
        throw new Error(`The main entry point to your app was not found. Make sure "${originalMainScript}" exists and does not get ignored by your ignore option`);
    }
    (0, exports.debug)('Validation complete');
}
exports.validateElectronApp = validateElectronApp;
function hostInfo() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const metadata = require('../package.json');
    return `Electron Packager ${metadata.version}\n` +
        `Node ${process.version}\n` +
        `Host Operating system: ${process.platform} ${os_1.default.release()} (${process.arch})`;
}
exports.hostInfo = hostInfo;
//# sourceMappingURL=common.js.map