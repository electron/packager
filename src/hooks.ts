import { promisify } from 'util';
import { FinalizePackageTargetsHookFunction, HookFunction, HookFunctionErrorCallback } from './types';

export async function promisifyHooks(hooks: HookFunction[] | FinalizePackageTargetsHookFunction[] | undefined, args?: unknown[]) {
  if (!hooks || !Array.isArray(hooks)) {
    return Promise.resolve();
  }

  await Promise.all(hooks.map(hookFn => promisify(hookFn).apply(promisifyHooks, args)));
}

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
export function serialHooks(hooks: Parameters<typeof promisifyHooks>[0] = []) {
  return async function runSerialHook(...serialHookParams: Parameters<HookFunction | FinalizePackageTargetsHookFunction>) {
    const args = Array.prototype.slice.call(serialHookParams, 0, -1) as Parameters<HookFunction>;
    const [done] = (Array.prototype.slice.call(serialHookParams, -1)) as [HookFunctionErrorCallback];

    for (const hook of hooks) {
      await (hook as HookFunction).apply(runSerialHook, args);
    }

    return done();
  };
}
