import createDebug from 'debug';
import { ComboOptions, Options } from './types';
import { CreateOptions as AsarOptions } from '@electron/asar';
export declare const debug: createDebug.Debugger;
export declare function sanitizeAppName(name: string): string;
export declare function generateFinalBasename(opts: Pick<ComboOptions, 'arch' | 'name' | 'platform'>): string;
export declare function generateFinalPath(opts: ComboOptions): string;
export declare function info(message: unknown, quiet?: boolean): void;
export declare function warning(message: unknown, quiet?: boolean): void;
export declare function subOptionWarning(properties: Record<string, unknown>, optionName: string, parameter: string, value: unknown, quiet?: boolean): void;
export declare function createAsarOpts(opts: ComboOptions): false | AsarOptions;
export declare function ensureArray<T>(value: T | T[]): T[];
export declare function isPlatformMac(platform: ComboOptions['platform']): boolean;
export declare function baseTempDir(opts: Options): string;
/**
 * Convert slashes to UNIX-format separators.
 */
export declare function normalizePath(pathToNormalize: string): string;
/**
 * Validates that the application directory contains a package.json file, and that there exists an
 * appropriate main entry point file, per the rules of the "main" field in package.json.
 *
 * See: https://docs.npmjs.com/cli/v6/configuring-npm/package-json#main
 *
 * @param appDir - the directory specified by the user
 * @param bundledAppDir - the directory where the appDir is copied to in the bundled Electron app
 */
export declare function validateElectronApp(appDir: string, bundledAppDir: string): Promise<void>;
export declare function hostInfo(): string;
