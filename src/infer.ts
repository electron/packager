import parseAuthor from 'parse-author';
import path from 'node:path';
import { createRequire } from 'node:module';
import { promisifiedGracefulFs } from './util.js';
import { debug } from './common.js';
import { OfficialPlatform, Options, ProcessedOptions } from './types.js';

type PackageJSON = {
  name?: string;
  productName?: string;
  version?: string;
  author?: string | { name?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const ELECTRON_PACKAGES = ['electron', 'electron-nightly'] as const;

async function* walkPackageJSONs(dir: string): AsyncGenerator<{ src: string; pkg: PackageJSON }> {
  let prev: string | undefined;
  let cur = path.resolve(dir);
  while (cur !== prev) {
    const src = path.join(cur, 'package.json');
    try {
      const contents = await promisifiedGracefulFs.readFile(src, 'utf8');
      yield { src, pkg: JSON.parse(contents.replace(/^\uFEFF/, '')) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    prev = cur;
    cur = path.dirname(cur);
  }
}

function errorMessageForProperty(propDescription: string, hash: string) {
  return (
    `Unable to determine ${propDescription}. Please specify an ${propDescription}\n\n` +
    'For more information, please see\n' +
    `https://electron.github.io/packager/main/interfaces/Options.html#${hash}\n`
  );
}

async function resolveElectronVersion(packageName: string, fromSrc: string) {
  const pkgJsonPath = createRequire(fromSrc).resolve(`${packageName}/package.json`);
  const pkg = JSON.parse(await promisifiedGracefulFs.readFile(pkgJsonPath, 'utf8'));
  debug(`Inferring target Electron version from ${packageName} in ${fromSrc}`);
  return pkg.version;
}

export async function getMetadataFromPackageJSON(
  platforms: OfficialPlatform[],
  opts: Options,
  dir: string,
): Promise<Partial<ProcessedOptions>> {
  const result: Partial<ProcessedOptions> = {};

  let needName = !opts.name;
  let needVersion = !opts.appVersion;
  let needElectron = !opts.electronVersion;
  let needAuthor = platforms.includes('win32') && !opts.win32metadata?.CompanyName;

  if (needAuthor) {
    debug('Requiring author in package.json, as CompanyName was not specified for win32metadata');
  }

  const initiallyNeeded = [
    needName && 'productName',
    needVersion && 'version',
    needElectron && 'dependencies.electron',
    needAuthor && 'author',
  ].filter(Boolean) as string[];

  if (!initiallyNeeded.length) return result;

  for await (const { src, pkg } of walkPackageJSONs(dir)) {
    if (needName) {
      const name = pkg.productName ?? pkg.name;
      if (name !== undefined) {
        const field = pkg.productName !== undefined ? 'productName' : 'name';
        debug(`Inferring application name from ${field} in ${src}`);
        result.name = name;
        needName = false;
      }
    }

    if (needVersion && pkg.version !== undefined) {
      debug(`Inferring appVersion from version in ${src}`);
      result.appVersion = pkg.version;
      needVersion = false;
    }

    if (needAuthor && pkg.author !== undefined) {
      debug(`Inferring win32metadata.CompanyName from author in ${src}`);
      const win32metadata = opts.win32metadata || {};
      if (typeof pkg.author === 'string') {
        win32metadata.CompanyName = parseAuthor(pkg.author).name;
      } else if (pkg.author.name) {
        win32metadata.CompanyName = pkg.author.name;
      } else {
        debug('Cannot infer win32metadata.CompanyName from author, no name found');
      }
      result.win32metadata = win32metadata;
      needAuthor = false;
    }

    if (needElectron) {
      for (const packageName of ELECTRON_PACKAGES) {
        if (
          pkg.dependencies?.[packageName] !== undefined ||
          pkg.devDependencies?.[packageName] !== undefined
        ) {
          result.electronVersion = await resolveElectronVersion(packageName, src);
          needElectron = false;
          break;
        }
      }
    }

    if (!needName && !needVersion && !needElectron && !needAuthor) break;
  }

  const stillMissing = [
    needName && 'productName',
    needVersion && 'version',
    needElectron && 'dependencies.electron',
    needAuthor && 'author',
  ].filter(Boolean) as string[];

  if (stillMissing.length) {
    if (stillMissing.length === initiallyNeeded.length) {
      throw new Error(
        `Could not locate a package.json file in "${path.resolve(opts.dir)}" or its parent directories for an Electron app with the following fields: ${initiallyNeeded.join(', ')}`,
      );
    }
    if (needName || needElectron) {
      const messages: string[] = [];
      if (needName) messages.push(errorMessageForProperty('application name', 'name'));
      if (needVersion) messages.push(errorMessageForProperty('application version', 'appversion'));
      if (needElectron)
        messages.push(errorMessageForProperty('Electron version', 'electronversion'));
      throw new Error(messages.join('\n') + '\n');
    }
  }

  return result;
}
