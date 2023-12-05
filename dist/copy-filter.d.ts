import { ComboOptions, Options } from './types';
import { CopyFilterAsync } from 'fs-extra';
export declare function populateIgnoredPaths(opts: Options): void;
export declare function generateIgnoredOutDirs(opts: ComboOptions): string[];
export declare function userPathFilter(opts: ComboOptions): CopyFilterAsync;
