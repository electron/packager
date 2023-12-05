import getPackageInfo, { GetPackageInfoError, GetPackageInfoResult, GetPackageInfoResultSourceItem } from 'get-package-info';
import parseAuthor from 'parse-author';
import path from 'path';
import resolve, { AsyncOpts } from 'resolve';
import { debug } from './common';
import { Options, SupportedPlatform } from './types';

function isMissingRequiredProperty(props: string[]) {
  return props.some(prop => prop === 'productName' || prop === 'dependencies.electron');
}

function errorMessageForProperty(prop: string) {
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

function resolvePromise(id: string, options: AsyncOpts) {
  // eslint-disable-next-line promise/param-names
  return new Promise<[string | undefined, { version: string }]>((accept, reject) => {
    resolve(id, options, (err, mainPath, pkg) => {
      if (err) {
        /* istanbul ignore next */
        reject(err);
      } else {
        accept([mainPath as string | undefined, pkg as { version: string }]);
      }
    });
  });
}

async function getVersion(opts: Options, electronProp: GetPackageInfoResultSourceItem) {
  const [, packageName] = electronProp.prop.split('.');
  const src = electronProp.src;

  const pkg = (await resolvePromise(packageName, { basedir: path.dirname(src) }))[1];
  debug(`Inferring target Electron version from ${packageName} in ${src}`);
  opts.electronVersion = pkg.version;
}

async function handleMetadata(opts: Options, result: GetPackageInfoResult): Promise<void> {
  if (result.values.productName) {
    debug(`Inferring application name from ${result.source.productName.prop} in ${result.source.productName.src}`);
    opts.name = result.values.productName as string;
  }

  if (result.values.version) {
    debug(`Inferring appVersion from version in ${result.source.version.src}`);
    opts.appVersion = result.values.version as string;
  }

  if (result.values.author && !opts.win32metadata) {
    opts.win32metadata = {};
  }

  if (result.values.author) {
    const author = result.values.author as string | { name: string };

    debug(`Inferring win32metadata.CompanyName from author in ${result.source.author.src}`);
    if (typeof author === 'string') {
      opts.win32metadata!.CompanyName = parseAuthor(author).name;
    } else if (author.name) {
      opts.win32metadata!.CompanyName = author.name;
    } else {
      debug('Cannot infer win32metadata.CompanyName from author, no name found');
    }
  }

  // eslint-disable-next-line no-prototype-builtins
  if (result.values.hasOwnProperty('dependencies.electron')) {
    return getVersion(opts, result.source['dependencies.electron']);
  } else {
    return Promise.resolve();
  }
}

function handleMissingProperties(opts: Options, err: GetPackageInfoError) {
  const missingProps = err.missingProps.map(prop => {
    return Array.isArray(prop) ? prop[0] : prop;
  });

  if (isMissingRequiredProperty(missingProps)) {
    const messages = missingProps.map(errorMessageForProperty);

    debug(err.message);
    err.message = messages.join('\n') + '\n';
    throw err;
  } else {
    // Missing props not required, can continue w/ partial result
    return handleMetadata(opts, err.result);
  }
}

export async function getMetadataFromPackageJSON(platforms: SupportedPlatform[], opts: Options, dir: string): Promise<void> {
  const props: Array<string | string[]> = [];

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
    debug('Requiring author in package.json, as CompanyName was not specified for win32metadata');
    props.push('author');
  }

  // Name and version provided, no need to infer
  if (props.length === 0) {
    return Promise.resolve();
  }

  // Search package.json files to infer name and version from
  try {
    const result = await getPackageInfo(props, dir);
    return handleMetadata(opts, result);
  } catch (e) {
    const err = e as GetPackageInfoError;

    if (err.missingProps) {
      if (err.missingProps.length === props.length) {
        debug(err.message);
        err.message = `Could not locate a package.json file in "${path.resolve(opts.dir)}" or its parent directories for an Electron app with the following fields: ${err.missingProps.join(', ')}`;
      } else {
        return handleMissingProperties(opts, err);
      }
    }

    throw err;
  }
}
