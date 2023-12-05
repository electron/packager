"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateListFromOptions = exports.allOfficialArchsForPlatformAndVersion = exports.createPlatformArchPairs = exports.supported = exports.osModules = exports.officialPlatformArchCombos = exports.officialPlatforms = exports.officialArchs = void 0;
const common_1 = require("./common");
const get_1 = require("@electron/get");
const semver_1 = __importDefault(require("semver"));
exports.officialArchs = ['ia32', 'x64', 'armv7l', 'arm64', 'mips64el', 'universal'];
exports.officialPlatforms = ['darwin', 'linux', 'mas', 'win32'];
exports.officialPlatformArchCombos = {
    darwin: ['x64', 'arm64', 'universal'],
    linux: ['ia32', 'x64', 'armv7l', 'arm64', 'mips64el'],
    mas: ['x64', 'arm64', 'universal'],
    win32: ['ia32', 'x64', 'arm64'],
};
const buildVersions = {
    darwin: {
        arm64: '>= 11.0.0-beta.1',
        universal: '>= 11.0.0-beta.1',
    },
    linux: {
        arm64: '>= 1.8.0',
        ia32: '<19.0.0-beta.1',
        mips64el: '^1.8.2-beta.5',
    },
    mas: {
        arm64: '>= 11.0.0-beta.1',
        universal: '>= 11.0.0-beta.1',
    },
    win32: {
        arm64: '>= 6.0.8',
    },
};
// Maps to module filename for each platform (lazy-required if used)
exports.osModules = {
    darwin: './mac',
    linux: './linux',
    mas: './mac',
    win32: './win32',
};
exports.supported = {
    arch: new Set(exports.officialArchs),
    platform: new Set(exports.officialPlatforms),
};
function createPlatformArchPairs(opts, selectedPlatforms, selectedArchs, ignoreFunc) {
    const combinations = [];
    for (const arch of selectedArchs) {
        for (const platform of selectedPlatforms) {
            if (usingOfficialElectronPackages(opts)) {
                if (!validOfficialPlatformArch(platform, arch)) {
                    warnIfAllNotSpecified(opts, `The platform/arch combination ${platform}/${arch} is not currently supported by Electron Packager`);
                    continue;
                }
                else if (buildVersions[platform] && buildVersions[platform][arch]) {
                    const buildVersion = buildVersions[platform][arch];
                    if (buildVersion && !officialBuildExists(opts, buildVersion)) {
                        warnIfAllNotSpecified(opts, `Official ${platform}/${arch} support only exists in Electron ${buildVersion}`);
                        continue;
                    }
                }
                if (typeof ignoreFunc === 'function' && ignoreFunc(platform, arch)) {
                    continue;
                }
            }
            combinations.push([platform, arch]);
        }
    }
    return combinations;
}
exports.createPlatformArchPairs = createPlatformArchPairs;
function unsupportedListOption(name, value, supportedValues) {
    return new Error(`Unsupported ${name}=${value} (${typeof value}); must be a string matching: ${Array.from(supportedValues.values())
        .join(', ')}`);
}
function usingOfficialElectronPackages(opts) {
    return !opts.download || !Object.prototype.hasOwnProperty.call(opts.download, 'mirrorOptions');
}
function validOfficialPlatformArch(platform, arch) {
    return exports.officialPlatformArchCombos[platform] && exports.officialPlatformArchCombos[platform].includes(arch);
}
function officialBuildExists(opts, buildVersion) {
    return semver_1.default.satisfies(opts.electronVersion, buildVersion, { includePrerelease: true });
}
function allPlatformsOrArchsSpecified(opts) {
    return opts.all || opts.arch === 'all' || opts.platform === 'all';
}
function warnIfAllNotSpecified(opts, message) {
    if (!allPlatformsOrArchsSpecified(opts)) {
        (0, common_1.warning)(message, opts.quiet);
    }
}
function allOfficialArchsForPlatformAndVersion(platform, electronVersion) {
    const archs = exports.officialPlatformArchCombos[platform];
    if (buildVersions[platform]) {
        const excludedArchs = Object.keys(buildVersions[platform])
            .filter(arch => !officialBuildExists({ electronVersion: electronVersion }, buildVersions[platform][arch]));
        return archs.filter(arch => !excludedArchs.includes(arch));
    }
    return archs;
}
exports.allOfficialArchsForPlatformAndVersion = allOfficialArchsForPlatformAndVersion;
// Validates list of architectures or platforms.
// Returns a normalized array if successful, or throws an Error.
function validateListFromOptions(opts, name) {
    if (opts.all) {
        return Array.from(exports.supported[name].values());
    }
    let list = opts[name];
    if (!list) {
        if (name === 'arch') {
            list = (0, get_1.getHostArch)();
        }
        else {
            list = process[name];
        }
    }
    else if (list === 'all') {
        return Array.from(exports.supported[name].values());
    }
    if (!Array.isArray(list)) {
        if (typeof list === 'string') {
            list = list.split(/,\s*/);
        }
        else {
            return unsupportedListOption(name, list, exports.supported[name]);
        }
    }
    const officialElectronPackages = usingOfficialElectronPackages(opts);
    for (const value of list) {
        if (officialElectronPackages && !exports.supported[name].has(value)) {
            return unsupportedListOption(name, value, exports.supported[name]);
        }
    }
    return list;
}
exports.validateListFromOptions = validateListFromOptions;
//# sourceMappingURL=targets.js.map