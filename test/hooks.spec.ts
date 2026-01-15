import { runHooks, serialHooks } from '../src/hooks.js';
import { describe, it, expect } from 'vitest';

describe('promisifyHooks', () => {
  it('should call hooks in parallel', async () => {
    let output = '0';
    const makeHook = (number: number, msTimeout: number) => {
      return async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            output += ` ${number}`;
            resolve();
          }, msTimeout);
        });
      };
    };
    const testHooks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) =>
      makeHook(number, number % 2 === 0 ? 100 : 0),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runHooks(testHooks as any, {} as any);
    // all numbers should be printed in the output string
    expect(output).toHaveLength(22);
    expect(output).not.toBe('0 1 2 3 4 5 6 7 8 9 10');
  });

  describe('serialHooks', () => {
    it('should call hooks in order', async () => {
      let output = '0';
      const makeHook = (number: number, msTimeout: number) => {
        return async () => {
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              output += ` ${number}`;
              resolve();
            }, msTimeout);
          });
        };
      };
      const testHooks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) =>
        makeHook(number, number % 2 === 0 ? 100 : 0),
      );

      const serializedHooks = serialHooks(testHooks);
      await runHooks(serializedHooks, {
        buildPath: '',
        electronVersion: '',
        platform: 'darwin',
        arch: 'arm64',
      });
      expect(output).toBe('0 1 2 3 4 5 6 7 8 9 10');
    });
  });
});
