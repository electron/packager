import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';
import { WindowsApp } from '../src/win32.js';
import { resedit } from '../src/resedit.js';
import { promisifiedGracefulFs } from '../src/util.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Ref: https://learn.microsoft.com/en-us/windows/win32/menurc/resource-types
const RT_MANIFEST_TYPE = 24;
const LANG_EN_US = 1033;

const FIXTURE_MANIFEST = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">',
  '  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">',
  '    <security>',
  '      <requestedPrivileges>',
  '        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>',
  '      </requestedPrivileges>',
  '    </security>',
  '  </trustInfo>',
  '</assembly>',
  '',
].join('\r\n');

function toExactArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length);
}

/**
 * Builds a minimal Windows executable containing the resources that
 * `resedit()` requires to exist: exactly one RT_MANIFEST entry and exactly
 * one version info entry with a single string table language.
 */
async function createFixtureExe(exePath: string): Promise<void> {
  const exe = NtExecutable.createEmpty(false, false);
  const res = NtExecutableResource.from(exe);

  const manifestBuffer = Buffer.from(FIXTURE_MANIFEST, 'utf-8');
  res.entries.push({
    type: RT_MANIFEST_TYPE,
    id: 1,
    bin: toExactArrayBuffer(manifestBuffer),
    lang: LANG_EN_US,
    codepage: 1252,
  });

  const versionInfo = Resource.VersionInfo.create(LANG_EN_US, {}, [
    { lang: LANG_EN_US, codepage: 1200, values: { ProductName: 'Fixture' } },
  ]);
  versionInfo.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  await fs.promises.writeFile(exePath, Buffer.from(exe.generate()));
}

async function readManifestFromExe(exePath: string): Promise<string> {
  const exe = NtExecutable.from(await fs.promises.readFile(exePath));
  const res = NtExecutableResource.from(exe);
  const manifests = res.entries.filter((entry) => entry.type === RT_MANIFEST_TYPE);
  expect(manifests).toHaveLength(1);
  return Buffer.from(manifests[0].bin).toString('utf-8');
}

describe('resedit', () => {
  it('sets win32Metadata defaults', async () => {
    const opts = {
      name: 'Win32 App',
      arch: 'x64',
      platform: 'win32',
      dir: '',
      appVersion: '1.0.0',
      electronVersion: '1.0.0',
      ignore: () => false,
    } as const;
    const app = new WindowsApp(opts, '');
    const rcOpts = app.generateReseditOptionsSansIcon();

    expect(rcOpts.win32Metadata.FileDescription).toBe(opts.name);
    expect(rcOpts.win32Metadata.InternalName).toBe(opts.name);
    expect(rcOpts.win32Metadata.OriginalFilename).toBe('Win32 App.exe');
    expect(rcOpts.productName).toBe(opts.name);
  });

  it.each([
    {
      testOpts: { appVersion: '4.99.101.0', buildVersion: '101.0.4995.101' },
      expectedValues: {
        fileVersion: '101.0.4995.101',
        productVersion: '4.99.101.0',
      },
    },
    {
      testOpts: { appVersion: '4.99.101.0' },
      expectedValues: {
        fileVersion: '4.99.101.0',
        productVersion: '4.99.101.0',
      },
    },
    {
      testOpts: { appCopyright: 'Copyright Bar' },
      expectedValues: {
        legalCopyright: 'Copyright Bar',
      },
    },
    {
      testOpts: {
        win32metadata: { CompanyName: 'Foo' },
      },
      expectedValues: {
        'win32Metadata.CompanyName': 'Foo',
      },
    },
    {
      testOpts: {
        win32metadata: {
          'requested-execution-level': 'asInvoker' as const,
        },
      },
      expectedValues: {
        'win32Metadata.requested-execution-level': 'asInvoker',
      },
    },
    {
      testOpts: {
        win32metadata: {
          'application-manifest': '/path/to/manifest.xml',
        },
      },
      expectedValues: {
        'win32Metadata.application-manifest': '/path/to/manifest.xml',
      },
    },
  ])('sets the right version string for $testOpts', async ({ testOpts, expectedValues }) => {
    const opts = {
      name: 'Win32 App',
      arch: 'x64',
      platform: 'win32',
      dir: '',
      electronVersion: '1.0.0',
      ignore: () => false,
      appVersion: '1.0.0',
      ...testOpts,
    } as const;
    const app = new WindowsApp(opts, '');
    const rcOpts = app.generateReseditOptionsSansIcon();

    for (const [key, value] of Object.entries(expectedValues)) {
      expect(rcOpts).toHaveProperty(key, value);
    }
  });

  describe('manifest resources', () => {
    let tempDir: string;
    let exePath: string;

    beforeEach(async () => {
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'electron-packager-test-'));
      exePath = path.join(tempDir, 'fixture.exe');
      await createFixtureExe(exePath);
    });

    afterEach(async () => {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    it('embeds a custom application manifest byte-for-byte (#1933)', async () => {
      const customManifest = FIXTURE_MANIFEST.replace(
        '<assembly ',
        '<!-- distinctive custom manifest for issue #1933 --><assembly ',
      );
      const manifestPath = path.join(tempDir, 'custom.manifest');
      await fs.promises.writeFile(manifestPath, customManifest, 'utf-8');

      // The corruption in #1933 happens whenever the manifest Buffer is a
      // view into a larger backing ArrayBuffer (nonzero byteOffset and/or a
      // longer backing buffer), which is common in Node because of the
      // internal Buffer pool. Force that shape for the manifest read so this
      // test deterministically guards the regression.
      const realReadFile = promisifiedGracefulFs.readFile;
      const readFileSpy = vi
        .spyOn(promisifiedGracefulFs, 'readFile')
        .mockImplementation(async function (this: unknown, ...args) {
          const result = await (realReadFile as (...a: unknown[]) => Promise<unknown>).apply(
            this,
            args,
          );
          if (args[0] === manifestPath && Buffer.isBuffer(result)) {
            const backing = Buffer.alloc(result.length + 128, '<lots of garbage bytes/>');
            result.copy(backing, 64);
            const view = backing.subarray(64, 64 + result.length);
            expect(view.byteOffset).not.toBe(0);
            expect(view.buffer.byteLength).toBeGreaterThan(view.length);
            return view;
          }
          return result;
        } as typeof promisifiedGracefulFs.readFile);

      try {
        await resedit(exePath, {
          win32Metadata: { 'application-manifest': manifestPath },
        });
      } finally {
        readFileSpy.mockRestore();
      }

      expect(await readManifestFromExe(exePath)).toBe(customManifest);
    });

    it('replaces the requested execution level without corrupting the manifest', async () => {
      await resedit(exePath, {
        win32Metadata: { 'requested-execution-level': 'requireAdministrator' },
      });

      expect(await readManifestFromExe(exePath)).toBe(
        FIXTURE_MANIFEST.replace('level="asInvoker"', 'level="requireAdministrator"'),
      );
    });
  });
});
