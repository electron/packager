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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resedit = void 0;
const fs = __importStar(require("fs-extra"));
// eslint-disable-next-line import/no-unresolved
const cjs_1 = require("resedit/cjs");
/**
 * Parse a version string in the format a.b.c.d with each component being optional
 * but if present must be an integer. Matches the impl in rcedit for compat
 */
function parseVersionString(str) {
    const parts = str.split('.');
    if (parts.length === 0 || parts.length > 4) {
        throw new Error(`Incorrectly formatted version string: "${str}". Should have at least one and at most four components`);
    }
    return parts.map((part) => {
        const parsed = parseInt(part, 10);
        if (isNaN(parsed)) {
            throw new Error(`Incorrectly formatted version string: "${str}". Component "${part}" could not be parsed as an integer`);
        }
        return parsed;
    });
}
// Ref: https://learn.microsoft.com/en-us/windows/win32/menurc/resource-types
const RT_MANIFEST_TYPE = 24;
async function resedit(exePath, options) {
    const resedit = await (0, cjs_1.load)();
    const exeData = await fs.readFile(exePath);
    const exe = resedit.NtExecutable.from(exeData);
    const res = resedit.NtExecutableResource.from(exe);
    if (options.iconPath) {
        // Icon Info
        const existingIconGroups = resedit.Resource.IconGroupEntry.fromEntries(res.entries);
        if (existingIconGroups.length !== 1) {
            throw new Error('Failed to parse win32 executable resources, failed to locate existing icon group');
        }
        const iconFile = resedit.Data.IconFile.from(await fs.readFile(options.iconPath));
        resedit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, existingIconGroups[0].id, existingIconGroups[0].lang, iconFile.icons.map((item) => item.data));
    }
    // Manifest
    if (options.win32Metadata?.['application-manifest'] || options.win32Metadata?.['requested-execution-level']) {
        if (options.win32Metadata?.['application-manifest'] && options.win32Metadata?.['requested-execution-level']) {
            throw new Error('application-manifest and requested-execution-level are mutually exclusive, only provide one');
        }
        const manifests = res.entries.filter(e => e.type === RT_MANIFEST_TYPE);
        if (manifests.length !== 1) {
            throw new Error('Failed to parse win32 executable resources, failed to locate existing manifest');
        }
        const manifestEntry = manifests[0];
        if (options.win32Metadata?.['application-manifest']) {
            manifestEntry.bin = (await fs.readFile(options.win32Metadata?.['application-manifest'])).buffer;
        }
        else if (options.win32Metadata?.['requested-execution-level']) {
            // This implementation matches what rcedit used to do, in theory we can be Smarter
            // and use an actual XML parser, but for now let's match the old impl
            const currentManifestContent = Buffer.from(manifestEntry.bin).toString('utf-8');
            const newContent = currentManifestContent.replace(/(<requestedExecutionLevel level=")asInvoker(" uiAccess="false"\/>)/g, `$1${options.win32Metadata?.['requested-execution-level']}$2`);
            manifestEntry.bin = Buffer.from(newContent, 'utf-8');
        }
    }
    // Version Info
    const versionInfo = resedit.Resource.VersionInfo.fromEntries(res.entries);
    if (versionInfo.length !== 1) {
        throw new Error('Failed to parse win32 executable resources, failed to locate existing version info');
    }
    if (options.fileVersion)
        versionInfo[0].setFileVersion(...parseVersionString(options.fileVersion));
    if (options.productVersion)
        versionInfo[0].setProductVersion(...parseVersionString(options.productVersion));
    const languageInfo = versionInfo[0].getAllLanguagesForStringValues();
    if (languageInfo.length !== 1) {
        throw new Error('Failed to parse win32 executable resources, failed to locate existing language info');
    }
    // Empty strings retain original value
    const newStrings = {
        CompanyName: options.win32Metadata?.CompanyName || '',
        FileDescription: options.win32Metadata?.FileDescription || '',
        FileVersion: options.fileVersion || '',
        InternalName: options.win32Metadata?.InternalName || '',
        LegalCopyright: options.legalCopyright || '',
        OriginalFilename: options.win32Metadata?.OriginalFilename || '',
        ProductName: options.productName || '',
        ProductVersion: options.productVersion || '',
    };
    for (const key of Object.keys(newStrings)) {
        if (!newStrings[key])
            delete newStrings[key];
    }
    versionInfo[0].setStringValues(languageInfo[0], newStrings);
    // Output version info
    versionInfo[0].outputToResourceEntries(res.entries);
    res.outputResource(exe);
    await fs.writeFile(exePath, Buffer.from(exe.generate()));
}
exports.resedit = resedit;
//# sourceMappingURL=resedit.js.map