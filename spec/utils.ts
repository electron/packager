import path from 'node:path';
import type { Options } from '../src/types';

export function generateResourcesPath(
  opts: Pick<Options, 'name' | 'platform'>,
) {
  if (opts.platform === 'darwin') {
    return path.join(`${opts.name}.app`, 'Contents', 'Resources');
  } else {
    return 'resources';
  }
}

export function generateNamePath(opts: Pick<Options, 'name' | 'platform'>) {
  if (opts.platform === 'darwin') {
    return path.join(
      `${opts.name}.app`,
      'Contents',
      'Frameworks',
      `${opts.name} Helper.app`,
    );
  }

  return opts.name + (opts.platform === 'win32' ? '.exe' : '');
}
