import {
  FinalizePackageTargetsHookFunction,
  HookFunction,
  HookFunctionErrorCallback,
} from './types.js';

export async function runHooks(
  hooks: HookFunction[] | undefined,
  opts: Parameters<HookFunction>[0],
): Promise<void>;
export async function runHooks(
  hooks: FinalizePackageTargetsHookFunction[] | undefined,
  opts: Parameters<FinalizePackageTargetsHookFunction>[0],
): Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runHooks<T extends (...args: any[]) => any>(
  hooks: T[] | undefined,
  opts: Parameters<T>[0],
): Promise<void> {
  if (hooks === undefined || !Array.isArray(hooks)) {
    return;
  }

  await Promise.all(hooks.map((hook) => hook(opts)));
}

/**
 * By default, the functions are called in parallel (via
 * [`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)).
 * If you need the functions called serially, you can use the `serialHooks` utility function:
 *
 * ```javascript
 * import { packager, serialHooks } from '@electron/packager'
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
  return async function runSerialHook(
    ...serialHookParams: Parameters<
      HookFunction | FinalizePackageTargetsHookFunction
    >
  ) {
    const args = Array.prototype.slice.call(
      serialHookParams,
      0,
      -1,
    ) as Parameters<HookFunction>;
    const [done] = Array.prototype.slice.call(serialHookParams, -1) as [
      HookFunctionErrorCallback,
    ];

    for (const hook of hooks) {
      await (hook as HookFunction).apply(runSerialHook, args);
    }

    return done();
  };
}
