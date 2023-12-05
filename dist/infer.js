"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetadataFromPackageJSON = void 0;
const get_package_info_1 = __importDefault(require("get-package-info"));
const parse_author_1 = __importDefault(require("parse-author"));
const path_1 = __importDefault(require("path"));
const resolve_1 = __importDefault(require("resolve"));
const common_1 = require("./common");
function isMissingRequiredProperty(props) {
    return props.some(prop => prop === 'productName' || prop === 'dependencies.electron');
}
function errorMessageForProperty(prop) {
    let hash, propDescription;
    switch (prop) {
        case 'productName':
            hash = 'name';
            propDescription = 'application name';
            break;
        case 'dependencies.electron':
            hash = 'electronversion';
            propDescription = 'Electron version';
            break;
        case 'version':
            hash = 'appversion';
            propDescription = 'application version';
            break;
        /* istanbul ignore next */
        default:
            hash = '';
            propDescription = `[Unknown Property (${prop})]`;
    }
    return `Unable to determine ${propDescription}. Please specify an ${propDescription}\n\n` +
        'For more information, please see\n' +
        `https://electron.github.io/packager/main/interfaces/electronpackager.options.html#${hash}\n`;
}
function resolvePromise(id, options) {
    // eslint-disable-next-line promise/param-names
    return new Promise((accept, reject) => {
        (0, resolve_1.default)(id, options, (err, mainPath, pkg) => {
            if (err) {
                /* istanbul ignore next */
                reject(err);
            }
            else {
                accept([mainPath, pkg]);
            }
        });
    });
}
async function getVersion(opts, electronProp) {
    const [, packageName] = electronProp.prop.split('.');
    const src = electronProp.src;
    const pkg = (await resolvePromise(packageName, { basedir: path_1.default.dirname(src) }))[1];
    (0, common_1.debug)(`Inferring target Electron version from ${packageName} in ${src}`);
    opts.electronVersion = pkg.version;
}
async function handleMetadata(opts, result) {
    if (result.values.productName) {
        (0, common_1.debug)(`Inferring application name from ${result.source.productName.prop} in ${result.source.productName.src}`);
        opts.name = result.values.productName;
    }
    if (result.values.version) {
        (0, common_1.debug)(`Inferring appVersion from version in ${result.source.version.src}`);
        opts.appVersion = result.values.version;
    }
    if (result.values.author && !opts.win32metadata) {
        opts.win32metadata = {};
    }
    if (result.values.author) {
        const author = result.values.author;
        (0, common_1.debug)(`Inferring win32metadata.CompanyName from author in ${result.source.author.src}`);
        if (typeof author === 'string') {
            opts.win32metadata.CompanyName = (0, parse_author_1.default)(author).name;
        }
        else if (author.name) {
            opts.win32metadata.CompanyName = author.name;
        }
        else {
            (0, common_1.debug)('Cannot infer win32metadata.CompanyName from author, no name found');
        }
    }
    // eslint-disable-next-line no-prototype-builtins
    if (result.values.hasOwnProperty('dependencies.electron')) {
        return getVersion(opts, result.source['dependencies.electron']);
    }
    else {
        return Promise.resolve();
    }
}
function handleMissingProperties(opts, err) {
    const missingProps = err.missingProps.map(prop => {
        return Array.isArray(prop) ? prop[0] : prop;
    });
    if (isMissingRequiredProperty(missingProps)) {
        const messages = missingProps.map(errorMessageForProperty);
        (0, common_1.debug)(err.message);
        err.message = messages.join('\n') + '\n';
        throw err;
    }
    else {
        // Missing props not required, can continue w/ partial result
        return handleMetadata(opts, err.result);
    }
}
async function getMetadataFromPackageJSON(platforms, opts, dir) {
    const props = [];
    if (!opts.name) {
        props.push(['productName', 'name']);
    }
    if (!opts.appVersion) {
        props.push('version');
    }
    if (!opts.electronVersion) {
        props.push([
            'dependencies.electron',
            'devDependencies.electron',
            'dependencies.electron-nightly',
            'devDependencies.electron-nightly'
        ]);
    }
    if (platforms.includes('win32') && !(opts.win32metadata && opts.win32metadata.CompanyName)) {
        (0, common_1.debug)('Requiring author in package.json, as CompanyName was not specified for win32metadata');
        props.push('author');
    }
    // Name and version provided, no need to infer
    if (props.length === 0) {
        return Promise.resolve();
    }
    // Search package.json files to infer name and version from
    try {
        const result = await (0, get_package_info_1.default)(props, dir);
        return handleMetadata(opts, result);
    }
    catch (e) {
        const err = e;
        if (err.missingProps) {
            if (err.missingProps.length === props.length) {
                (0, common_1.debug)(err.message);
                err.message = `Could not locate a package.json file in "${path_1.default.resolve(opts.dir)}" or its parent directories for an Electron app with the following fields: ${err.missingProps.join(', ')}`;
            }
            else {
                return handleMissingProperties(opts, err);
            }
        }
        throw err;
    }
}
exports.getMetadataFromPackageJSON = getMetadataFromPackageJSON;
//# sourceMappingURL=infer.js.map