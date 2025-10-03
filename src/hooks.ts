import { FinalizePackageTargetsHookFunction, HookFunction } from './types.js';

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
 * If you need the functions called serially, you can use the `serialHooks` utility function.
 */
export function serialHooks(
  hooks: HookFunction[],
): (opts: Parameters<HookFunction>[0]) => Promise<void>;
export function serialHooks(
  hooks: FinalizePackageTargetsHookFunction[],
): (opts: Parameters<FinalizePackageTargetsHookFunction>[0]) => Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialHooks<T extends (...args: any[]) => any>(
  hooks: T[] = [],
) {
  return async function (opts: Parameters<T>[0]): Promise<void> {
    for (const hook of hooks) {
      await hook(opts);
    }
  };
}
