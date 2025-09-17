import {
  baseTempDir,
  debug,
  ensureArray,
  generateFinalBasename,
  normalizePath,
} from './common.js';
import { isJunk } from 'junk';
import path from 'node:path';
import { isModule, Pruner } from './prune.js';
import { officialPlatformArchCombos } from './targets.js';
import {
  ProcessedOptionsWithSinglePlatformArch,
  OfficialArch,
  OfficialPlatform,
  Options,
  ProcessedOptions,
} from './types.js';
import { CopyOptions } from 'node:fs';

const DEFAULT_IGNORES = [
  '/package-lock\\.json$',
  '/yarn\\.lock$',
  '/pnpm-lock\\.yaml$',
  '/\\.git($|/)',
  '/node_modules/\\.bin($|/)',
  '\\.o(bj)?$',
  '/node_gyp_bins($|/)',
];

export function populateIgnoredPaths(
  opts: Options,
): Pick<ProcessedOptions, 'ignore' | 'originalIgnore'> {
  const originalIgnore = opts.ignore;
  let ignore: ProcessedOptions['ignore'];

  if (typeof opts.ignore !== 'function') {
    const ignoreArray = opts.ignore
      ? [...ensureArray(opts.ignore), ...DEFAULT_IGNORES]
      : [...DEFAULT_IGNORES];
    if (process.platform === 'linux') {
      ignoreArray.push(baseTempDir(opts));
    }
    ignore = ignoreArray;

    debug('Ignored path regular expressions:', ignore);
  } else {
    ignore = opts.ignore;
  }

  return {
    ignore,
    originalIgnore,
  };
}

export function generateIgnoredOutDirs(
  opts: ProcessedOptionsWithSinglePlatformArch,
): string[] {
  const normalizedOut = opts.out ? path.resolve(opts.out) : null;
  const ignoredOutDirs: string[] = [];

  if (normalizedOut === null || normalizedOut === process.cwd()) {
    for (const [platform, archs] of Object.entries(
      officialPlatformArchCombos,
    )) {
      for (const arch of archs) {
        const basenameOpts = {
          arch: arch as OfficialArch,
          name: opts.name,
          platform: platform as OfficialPlatform,
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
  ignore: Exclude<ProcessedOptionsWithSinglePlatformArch['ignore'], undefined>,
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

export function userPathFilter(
  opts: ProcessedOptionsWithSinglePlatformArch,
): CopyOptions['filter'] {
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
      if (isJunk(path.basename(fullPath))) {
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
  };
}
