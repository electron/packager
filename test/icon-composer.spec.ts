import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spawn = vi.hoisted(() => vi.fn());

vi.mock('@malept/cross-spawn-promise', () => ({ spawn }));

const VERSION_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.actool.version</key>
  <dict>
    <key>short-bundle-version</key>
    <string>26.0.0</string>
  </dict>
</dict>
</plist>`;

describe('generateAssetCatalogForIcon', () => {
  beforeEach(() => {
    vi.spyOn(os, 'release').mockReturnValue('26.0.0');
    spawn.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args[0] === '--version') {
        return VERSION_PLIST;
      }
      // The `--compile` invocation: emulate `actool` writing the catalog.
      const outputPath = args[args.indexOf('--compile') + 1];
      await fs.writeFile(path.resolve(outputPath, 'Assets.car'), 'compiled');
      return '';
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compiles each unique icon only once and reuses the result', async () => {
    // Import lazily with a fresh module so the module-level cache starts empty.
    vi.resetModules();
    const { generateAssetCatalogForIcon } = await import('../src/icon-composer.js');

    const iconA = path.resolve(os.tmpdir(), 'A.icon');
    const iconB = path.resolve(os.tmpdir(), 'B.icon');
    await fs.mkdir(iconA, { recursive: true });
    await fs.mkdir(iconB, { recursive: true });

    const compileCalls = () =>
      spawn.mock.calls.filter((call) => (call[1] as string[]).includes('--compile')).length;

    const [first, second] = await Promise.all([
      generateAssetCatalogForIcon(iconA),
      generateAssetCatalogForIcon(iconA),
    ]);
    // Same input path -> `actool --compile` runs exactly once.
    expect(compileCalls()).toBe(1);
    expect(first.equals(second)).toBe(true);

    // A relative path resolving to the same icon hits the cache too.
    const third = await generateAssetCatalogForIcon(path.relative(process.cwd(), iconA));
    expect(compileCalls()).toBe(1);
    expect(third.equals(first)).toBe(true);

    // A different icon compiles again.
    await generateAssetCatalogForIcon(iconB);
    expect(compileCalls()).toBe(2);
  });
});
