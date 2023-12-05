import { FinalizePackageTargetsHookFunction, HookFunction } from './types';
export declare function promisifyHooks(hooks: HookFunction[] | FinalizePackageTargetsHookFunction[] | undefined, args?: unknown[]): Promise<void>;
/**
 * By default, the functions are called in parallel (via
 * [`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)).
 * If you need the functions called serially, you can use the `serialHooks` utility function:
 *
 * ```javascript
 * const { packager, serialHooks } = require('@electron/packager')
 *
 * packager({
 *   // ...
 *   afterCopy: [serialHooks([
 *     (buildPath, electronVersion, platform, arch, callback) => {
 *       setTimeout(() => {
 *         console.log('first function')
 *         callback()
 *       }, 1000)
 *     },
 *     (buildPath, electronVersion, platform, arch, callback) => {
 *       console.log('second function')
 *       callback()
 *     }
 *   ])],
 *   // ...
 * })
 * ```
 */
export declare function serialHooks(hooks?: Parameters<typeof promisifyHooks>[0]): (...serialHookParams: Parameters<HookFunction | FinalizePackageTargetsHookFunction>) => Promise<void>;
