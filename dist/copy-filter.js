"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userPathFilter = exports.generateIgnoredOutDirs = exports.populateIgnoredPaths = void 0;
const common_1 = require("./common");
const junk_1 = __importDefault(require("junk"));
const path_1 = __importDefault(require("path"));
const prune_1 = require("./prune");
const targets_1 = require("./targets");
const DEFAULT_IGNORES = [
    '/package-lock\\.json$',
    '/yarn\\.lock$',
    '/\\.git($|/)',
    '/node_modules/\\.bin($|/)',
    '\\.o(bj)?$',
    '/node_gyp_bins($|/)',
];
function populateIgnoredPaths(opts) {
    opts.originalIgnore = opts.ignore;
    if (typeof (opts.ignore) !== 'function') {
        if (opts.ignore) {
            opts.ignore = [...(0, common_1.ensureArray)(opts.ignore), ...DEFAULT_IGNORES];
        }
        else {
            opts.ignore = [...DEFAULT_IGNORES];
        }
        if (process.platform === 'linux') {
            opts.ignore.push((0, common_1.baseTempDir)(opts));
        }
        (0, common_1.debug)('Ignored path regular expressions:', opts.ignore);
    }
}
exports.populateIgnoredPaths = populateIgnoredPaths;
function generateIgnoredOutDirs(opts) {
    const normalizedOut = opts.out ? path_1.default.resolve(opts.out) : null;
    const ignoredOutDirs = [];
    if (normalizedOut === null || normalizedOut === process.cwd()) {
        for (const [platform, archs] of Object.entries(targets_1.officialPlatformArchCombos)) {
            for (const arch of archs) {
                const basenameOpts = {
                    arch: arch,
                    name: opts.name,
                    platform: platform,
                };
                ignoredOutDirs.push(path_1.default.join(process.cwd(), (0, common_1.generateFinalBasename)(basenameOpts)));
            }
        }
    }
    else {
        ignoredOutDirs.push(normalizedOut);
    }
    (0, common_1.debug)('Ignored paths based on the out param:', ignoredOutDirs);
    return ignoredOutDirs;
}
exports.generateIgnoredOutDirs = generateIgnoredOutDirs;
function generateFilterFunction(ignore) {
    if (typeof (ignore) === 'function') {
        return file => !ignore(file);
    }
    else {
        const ignoredRegexes = (0, common_1.ensureArray)(ignore);
        return function filterByRegexes(file) {
            return !ignoredRegexes.some(regex => file.match(regex));
        };
    }
}
function userPathFilter(opts) {
    const filterFunc = generateFilterFunction(opts.ignore || []);
    const ignoredOutDirs = generateIgnoredOutDirs(opts);
    const pruner = opts.prune ? new prune_1.Pruner(opts.dir, Boolean(opts.quiet)) : null;
    return async function filter(file) {
        const fullPath = path_1.default.resolve(file);
        if (ignoredOutDirs.includes(fullPath)) {
            return false;
        }
        if (opts.junk !== false) { // defaults to true
            if (junk_1.default.is(path_1.default.basename(fullPath))) {
                return false;
            }
        }
        let name = fullPath.split(path_1.default.resolve(opts.dir))[1];
        if (path_1.default.sep === '\\') {
            name = (0, common_1.normalizePath)(name);
        }
        if (pruner && name.startsWith('/node_modules/')) {
            if (await (0, prune_1.isModule)(file)) {
                return pruner.pruneModule(name);
            }
            else {
                return filterFunc(name);
            }
        }
        return filterFunc(name);
    };
}
exports.userPathFilter = userPathFilter;
//# sourceMappingURL=copy-filter.js.map