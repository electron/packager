import { promisify } from 'util';
import { FinalizePackageTargetsHookFunction, HookFunction } from './types';

export async function promisifyHooks(hooks: HookFunction[] | FinalizePackageTargetsHookFunction[] | undefined, args: unknown[]) {
  if (!hooks || !Array.isArray(hooks)) {
    return Promise.resolve();
  }

  await Promise.all(hooks.map(hookFn => promisify(hookFn).apply(promisifyHooks, args)));
}

/**
 * @TODO(erikian): we're not really using this anywhere - should we remove it?
 */
// export function serialHooks(hooks) {
//   return async function() {
//     const args = Array.prototype.splice.call(arguments, 0, arguments.length - 1);
//     const done = arguments[arguments.length - 1];
//     for (const hook of hooks) {
//       await hook.apply(this, args);
//     }
//
//     return done(); // eslint-disable-line promise/no-callback-in-promise
//   };
// }
