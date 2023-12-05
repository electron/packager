"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serialHooks = exports.promisifyHooks = void 0;
const util_1 = require("util");
async function promisifyHooks(hooks, args) {
    if (!hooks || !Array.isArray(hooks)) {
        return Promise.resolve();
    }
    await Promise.all(hooks.map(hookFn => (0, util_1.promisify)(hookFn).apply(promisifyHooks, args)));
}
exports.promisifyHooks = promisifyHooks;
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
function serialHooks(hooks = []) {
    return async function runSerialHook(...serialHookParams) {
        const args = Array.prototype.slice.call(serialHookParams, 0, -1);
        const [done] = (Array.prototype.slice.call(serialHookParams, -1));
        for (const hook of hooks) {
            await hook.apply(runSerialHook, args);
        }
        return done();
    };
}
exports.serialHooks = serialHooks;
//# sourceMappingURL=hooks.js.map