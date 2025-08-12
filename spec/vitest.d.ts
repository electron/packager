import 'vitest';

interface CustomMatchers<R = unknown> {
  toBeDirectory: () => R;
  toBeFile: () => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
