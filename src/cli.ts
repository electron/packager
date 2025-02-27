import { info, hostInfo, warning } from './common';
import fs from 'fs-extra';
import { initializeProxy } from '@electron/get';
import { packager } from './packager';
import path from 'path';
import yargs from 'yargs-parser';
import { Options } from './types';

/* istanbul ignore next */
async function printUsageAndExit(isError: boolean) {
  const usage = (
    await fs.readFile(path.resolve(__dirname, '..', 'usage.txt'))
  ).toString();
  const print = isError ? console.error : console.log;
  print(usage);
  process.exit(isError ? 1 : 0);
}

export function parseArgs(argv: string[]) {
  const args = yargs(argv, {
    boolean: ['all', 'deref-symlinks', 'junk', 'overwrite', 'prune', 'quiet'],
    default: {
      'deref-symlinks': true,
      junk: true,
      prune: true,
    },
    string: ['electron-version', 'out'],
  });

  args.dir = args._[0];
  args.name = args._[1];

  const protocolSchemes = [].concat(args.protocol || []);
  const protocolNames = [].concat(args.protocolName || []);

  if (
    protocolSchemes &&
    protocolNames &&
    protocolNames.length === protocolSchemes.length
  ) {
    args.protocols = protocolSchemes.map(function (scheme, i) {
      return { schemes: [scheme], name: protocolNames[i] };
    });
  }

  if (args.out === '') {
    warning(
      'Specifying --out= without a value is the same as the default value',
      args.quiet,
    );
    args.out = null;
  }

  // Overrides for multi-typed arguments, because minimist doesn't support it

  // asar: `Object` or `true`
  if (args.asar === 'true' || args.asar instanceof Array) {
    warning(
      '--asar does not take any arguments, it only has sub-properties (see --help)',
      args.quiet,
    );
    args.asar = true;
  }

  // windows-sign: `Object` or `true`
  if (args.windowsSign === 'true') {
    warning(
      '--windows-sign does not take any arguments, it only has sub-properties (see --help)',
      args.quiet,
    );
    args.windowsSign = true;
  } else if (typeof args['windows-sign'] === 'object') {
    if (Array.isArray(args['windows-sign'])) {
      warning(
        'Remove --windows-sign (the bare flag) from the command line, only specify sub-properties (see --help)',
        args.quiet,
      );
    } else {
      // Keep kebab case of sub properties
      args.windowsSign = args['windows-sign'];
    }
  }

  // osx-sign: `Object` or `true`
  if (args.osxSign === 'true') {
    warning(
      '--osx-sign does not take any arguments, it only has sub-properties (see --help)',
      args.quiet,
    );
    args.osxSign = true;
  } else if (typeof args['osx-sign'] === 'object') {
    if (Array.isArray(args['osx-sign'])) {
      warning(
        'Remove --osx-sign (the bare flag) from the command line, only specify sub-properties (see --help)',
        args.quiet,
      );
    } else {
      // Keep kebab case of sub properties
      args.osxSign = args['osx-sign'];
    }
  }

  if (args.osxNotarize) {
    let notarize = true;
    if (
      typeof args.osxNotarize !== 'object' ||
      Array.isArray(args.osxNotarize)
    ) {
      warning(
        '--osx-notarize does not take any arguments, it only has sub-properties (see --help)',
        args.quiet,
      );
      notarize = false;
    } else if (!args.osxSign) {
      warning(
        'Notarization was enabled but macOS code signing was not, code signing is a requirement for notarization, notarize will not run',
        args.quiet,
      );
      notarize = false;
    }

    if (!notarize) {
      args.osxNotarize = null;
    }
  }

  // tmpdir: `String` or `false`
  if (args.tmpdir === 'false') {
    warning(
      '--tmpdir=false is deprecated, use --no-tmpdir instead',
      args.quiet,
    );
    args.tmpdir = false;
  }

  return args;
}

/* istanbul ignore next */ export async function run(argv: string[]) {
  const args = parseArgs(argv);

  if (args.help) {
    await printUsageAndExit(false);
  } else if (args.version) {
    if (typeof args.version !== 'boolean') {
      console.error(
        '--version does not take an argument. Perhaps you meant --app-version or --electron-version?\n',
      );
    }
    console.log(hostInfo());
    process.exit(0);
  } else if (!args.dir) {
    await printUsageAndExit(true);
  }

  initializeProxy();

  try {
    const appPaths = await packager(args as unknown as Options);
    if (appPaths.length > 1) {
      info(`Wrote new apps to:\n${appPaths.join('\n')}`, args.quiet);
    } else if (appPaths.length === 1) {
      info(`Wrote new app to: ${appPaths[0]}`, args.quiet);
    }
  } catch (e) {
    const err = e as Error;

    if (err.message) {
      console.error(err.message);
    } else {
      console.error(err, err.stack);
    }
    process.exit(1);
  }
}
