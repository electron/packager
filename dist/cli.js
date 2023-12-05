"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = exports.parseArgs = void 0;
const common_1 = require("./common");
const fs_extra_1 = __importDefault(require("fs-extra"));
const get_1 = require("@electron/get");
const packager_1 = require("./packager");
const path_1 = __importDefault(require("path"));
const yargs_parser_1 = __importDefault(require("yargs-parser"));
/* istanbul ignore next */
async function printUsageAndExit(isError) {
    const usage = (await fs_extra_1.default.readFile(path_1.default.resolve(__dirname, '..', 'usage.txt'))).toString();
    const print = isError ? console.error : console.log;
    print(usage);
    process.exit(isError ? 1 : 0);
}
function parseArgs(argv) {
    const args = (0, yargs_parser_1.default)(argv, {
        boolean: [
            'all',
            'deref-symlinks',
            'download.rejectUnauthorized',
            'junk',
            'overwrite',
            'prune',
            'quiet'
        ],
        default: {
            'deref-symlinks': true,
            'download.rejectUnauthorized': true,
            junk: true,
            prune: true
        },
        string: [
            'electron-version',
            'out'
        ]
    });
    args.dir = args._[0];
    args.name = args._[1];
    const protocolSchemes = [].concat(args.protocol || []);
    const protocolNames = [].concat(args.protocolName || []);
    if (protocolSchemes && protocolNames && protocolNames.length === protocolSchemes.length) {
        args.protocols = protocolSchemes.map(function (scheme, i) {
            return { schemes: [scheme], name: protocolNames[i] };
        });
    }
    if (args.out === '') {
        (0, common_1.warning)('Specifying --out= without a value is the same as the default value', args.quiet);
        args.out = null;
    }
    // Overrides for multi-typed arguments, because minimist doesn't support it
    // asar: `Object` or `true`
    if (args.asar === 'true' || args.asar instanceof Array) {
        (0, common_1.warning)('--asar does not take any arguments, it only has sub-properties (see --help)', args.quiet);
        args.asar = true;
    }
    // windows-sign: `Object` or `true`
    if (args.windowsSign === 'true') {
        (0, common_1.warning)('--windows-sign does not take any arguments, it only has sub-properties (see --help)', args.quiet);
        args.windowsSign = true;
    }
    else if (typeof args['windows-sign'] === 'object') {
        if (Array.isArray(args['windows-sign'])) {
            (0, common_1.warning)('Remove --windows-sign (the bare flag) from the command line, only specify sub-properties (see --help)', args.quiet);
        }
        else {
            // Keep kebab case of sub properties
            args.windowsSign = args['windows-sign'];
        }
    }
    // osx-sign: `Object` or `true`
    if (args.osxSign === 'true') {
        (0, common_1.warning)('--osx-sign does not take any arguments, it only has sub-properties (see --help)', args.quiet);
        args.osxSign = true;
    }
    else if (typeof args['osx-sign'] === 'object') {
        if (Array.isArray(args['osx-sign'])) {
            (0, common_1.warning)('Remove --osx-sign (the bare flag) from the command line, only specify sub-properties (see --help)', args.quiet);
        }
        else {
            // Keep kebab case of sub properties
            args.osxSign = args['osx-sign'];
        }
    }
    if (args.osxNotarize) {
        let notarize = true;
        if (typeof args.osxNotarize !== 'object' || Array.isArray(args.osxNotarize)) {
            (0, common_1.warning)('--osx-notarize does not take any arguments, it only has sub-properties (see --help)', args.quiet);
            notarize = false;
        }
        else if (!args.osxSign) {
            (0, common_1.warning)('Notarization was enabled but macOS code signing was not, code signing is a requirement for notarization, notarize will not run', args.quiet);
            notarize = false;
        }
        if (!notarize) {
            args.osxNotarize = null;
        }
    }
    // tmpdir: `String` or `false`
    if (args.tmpdir === 'false') {
        (0, common_1.warning)('--tmpdir=false is deprecated, use --no-tmpdir instead', args.quiet);
        args.tmpdir = false;
    }
    return args;
}
exports.parseArgs = parseArgs;
/* istanbul ignore next */ async function run(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        await printUsageAndExit(false);
    }
    else if (args.version) {
        if (typeof args.version !== 'boolean') {
            console.error('--version does not take an argument. Perhaps you meant --app-version or --electron-version?\n');
        }
        console.log((0, common_1.hostInfo)());
        process.exit(0);
    }
    else if (!args.dir) {
        await printUsageAndExit(true);
    }
    (0, get_1.initializeProxy)();
    try {
        const appPaths = await (0, packager_1.packager)(args);
        if (appPaths.length > 1) {
            (0, common_1.info)(`Wrote new apps to:\n${appPaths.join('\n')}`, args.quiet);
        }
        else if (appPaths.length === 1) {
            (0, common_1.info)(`Wrote new app to: ${appPaths[0]}`, args.quiet);
        }
    }
    catch (e) {
        const err = e;
        if (err.message) {
            console.error(err.message);
        }
        else {
            console.error(err, err.stack);
        }
        process.exit(1);
    }
}
exports.run = run;
//# sourceMappingURL=cli.js.map