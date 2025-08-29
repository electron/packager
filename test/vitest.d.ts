import 'vitest';

interface CustomMatchers<R = unknown> {
  toBeDirectory: () => R;
  toBeFile: () => R;
  toBeSymlink: () => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-empty-object-type
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
