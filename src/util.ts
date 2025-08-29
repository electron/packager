import gracefulFS from 'graceful-fs';
import { promisify } from 'node:util';

export const promisifiedGracefulFs = {
  readFile: promisify(gracefulFS.readFile),
  readdir: promisify(gracefulFS.readdir),
  rename: promisify(gracefulFS.rename),
  writeFile: promisify(gracefulFS.writeFile),
} as Pick<
  (typeof gracefulFS)['promises'],
  'readFile' | 'readdir' | 'rename' | 'writeFile'
>;
