import { FinalizePackageTargetsHookFunction, HookFunction } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (...args: any[]) => Promise<void>;

export async function runHooks<T extends Fn>(hooks: T[] | undefined, args?: Parameters<T>) {
  if (hooks === undefined || !Array.isArray(hooks)) {
    return Promise.resolve();
  }

  await Promise.all(hooks.map(hookFn => args ? hookFn(...args): hookFn()));
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
export function serialHooks(hooks: Parameters<typeof runHooks>[0] = []) {
  return async function runSerialHook(...serialHookParams: Parameters<HookFunction | FinalizePackageTargetsHookFunction>) {
    const args = Array.prototype.slice.call(serialHookParams, 0, -1) as Parameters<HookFunction>;

    for (const hook of hooks) {
      await (hook as HookFunction).apply(runSerialHook, args);
    }
  };
}
