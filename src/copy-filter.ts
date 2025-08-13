import {
  baseTempDir,
  debug,
  ensureArray,
  generateFinalBasename,
  normalizePath,
} from './common';
import junk from 'junk';
import path from 'path';
import { isModule, Pruner } from './prune';
import { officialPlatformArchCombos } from './targets';
import { ComboOptions, Options } from './types';
import { CopyFilterAsync } from 'fs-extra';

const DEFAULT_IGNORES = [
  '/package-lock\\.json$',
  '/yarn\\.lock$',
  '/pnpm-lock\\.yaml$',
  '/\\.git($|/)',
  '/node_modules/\\.bin($|/)',
  '\\.o(bj)?$',
  '/node_gyp_bins($|/)',
];

export function populateIgnoredPaths(opts: Options) {
  (opts as Options & { originalIgnore: Options['ignore'] }).originalIgnore =
    opts.ignore;

  if (typeof opts.ignore !== 'function') {
    if (opts.ignore) {
      opts.ignore = [...ensureArray(opts.ignore), ...DEFAULT_IGNORES];
    } else {
      opts.ignore = [...DEFAULT_IGNORES];
    }
    if (process.platform === 'linux') {
      opts.ignore.push(baseTempDir(opts));
    }

    debug('Ignored path regular expressions:', opts.ignore);
  }
}

export function generateIgnoredOutDirs(opts: ComboOptions): string[] {
  const normalizedOut = opts.out ? path.resolve(opts.out) : null;
  const ignoredOutDirs: string[] = [];

  if (normalizedOut === null || normalizedOut === process.cwd()) {
    for (const [platform, archs] of Object.entries(
      officialPlatformArchCombos,
    )) {
      for (const arch of archs) {
        const basenameOpts = {
          arch: arch,
          name: opts.name,
          platform: platform,
        };
        ignoredOutDirs.push(
          path.join(process.cwd(), generateFinalBasename(basenameOpts)),
        );
      }
    }
  } else {
    ignoredOutDirs.push(normalizedOut);
  }

  debug('Ignored paths based on the out param:', ignoredOutDirs);

  return ignoredOutDirs;
}

function generateFilterFunction(
  ignore: Exclude<ComboOptions['ignore'], undefined>,
): (file: string) => boolean {
  if (typeof ignore === 'function') {
    return (file) => !ignore(file);
  } else {
    const ignoredRegexes = ensureArray(ignore);

    return function filterByRegexes(file) {
      return !ignoredRegexes.some((regex) => file.match(regex));
    };
  }
}

export function userPathFilter(opts: ComboOptions): CopyFilterAsync {
  const filterFunc = generateFilterFunction(opts.ignore || []);
  const ignoredOutDirs = generateIgnoredOutDirs(opts);
  const pruner = opts.prune ? new Pruner(opts.dir, Boolean(opts.quiet)) : null;

  return async function filter(file) {
    const fullPath = path.resolve(file);

    if (ignoredOutDirs.includes(fullPath)) {
      return false;
    }

    if (opts.junk !== false) {
      // defaults to true
      if (junk.is(path.basename(fullPath))) {
        return false;
      }
    }

    let name = fullPath.split(path.resolve(opts.dir))[1];

    if (path.sep === '\\') {
      name = normalizePath(name);
    }

    if (pruner && name.startsWith('/node_modules/')) {
      if (await isModule(file)) {
        return pruner.pruneModule(name);
      } else {
        return filterFunc(name);
      }
    }

    return filterFunc(name);
  } as CopyFilterAsync;
}
