import { packager } from '../src/packager';
import { exec } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import util from 'node:util';
import fs from 'fs-extra';
import { generateFinalBasename } from '../src/common';
import { getHostArch } from '@electron/get';
import { describe, expect, vi } from 'vitest';
import {
  generateNamePath,
  generateResourcesPath,
  it,
  parseHelperInfoPlist,
  parseInfoPlist,
} from './utils';
import { Options } from '../src/types';
import { createDownloadOpts, downloadElectronZip } from '../src/download';
import plist, { PlistObject } from 'plist';
import { filterCFBundleIdentifier } from '../src/mac';

import { dynamicImport } from '../src/dynamicImport';
import type { NtExecutable, NtExecutableResource } from 'resedit';

describe('packager', () => {
  it('cannot build apps where the name ends in "Helper"', async ({
    baseOpts,
  }) => {
    const opts: Options = {
      ...baseOpts,
      name: 'Bad Helper',
    };

    await expect(packager(opts)).rejects.toThrowError(
      'Application names cannot end in " Helper" due to limitations on macOS',
    );
  });

  it.for([
    {
      electronVersion: '0.0.1',
    },
    { platform: 'android' },
    { arch: 'z80' },
  ])('cannot build with invalid option %s', async (testOpts, { baseOpts }) => {
    const opts: Options = {
      platform: 'linux', // required for electronVersion to fail
      arch: 'x64',
      ...baseOpts,
      ...testOpts,
    };

    await expect(packager(opts)).rejects.toThrow(expect.any(Error));
  });

  it('packages with defaults', async ({ baseOpts }) => {
    const opts: Options = {
      ...baseOpts,
    };

    const defaultOpts = {
      arch: getHostArch(),
      name: opts.name,
      platform: process.platform,
    };

    const paths = await packager(opts);
    expect(paths).toHaveLength(1);

    expect(paths[0]).toEqual(
      path.join(opts.out!, generateFinalBasename(defaultOpts)),
    );
    expect(fs.existsSync(paths[0])).toBe(true);

    const appPath = path.join(paths[0], generateNamePath(defaultOpts));
    const resourcesPath = path.join(
      paths[0],
      generateResourcesPath(defaultOpts),
    );

    if (process.platform === 'darwin') {
      expect(appPath).toBeDirectory();
    } else {
      expect(appPath).toBeFile();
    }
    expect(fs.existsSync(resourcesPath)).toBe(true);

    // Doesn't package devDependencies
    expect(
      fs.existsSync(
        path.join(resourcesPath, 'app', 'node_modules', 'run-waterfall'),
      ),
    ).toBe(false);

    // packages main.js
    const inputMain = path.join(__dirname, 'fixtures', 'basic', 'main.js');
    const outputMain = path.join(resourcesPath, 'app', 'main.js');

    expect(fs.readFileSync(inputMain, 'utf8')).toEqual(
      fs.readFileSync(outputMain, 'utf8'),
    );

    // packages subdirectory resources
    const inputResource = path.join(
      __dirname,
      'fixtures',
      'basic',
      'ignore',
      'this.txt',
    );
    const outputResource = path.join(
      resourcesPath,
      'app',
      'ignore',
      'this.txt',
    );

    expect(fs.readFileSync(inputResource, 'utf8')).toEqual(
      fs.readFileSync(outputResource, 'utf8'),
    );

    expect(fs.existsSync(path.join(resourcesPath, 'default_app'))).toBe(false);
    expect(fs.existsSync(path.join(resourcesPath, 'default_app.asar'))).toBe(
      false,
    );
  });

  it(
    'can overwrite older packages',
    { timeout: 30_000 }, // double the timeout because we have two full packager runs
    async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      expect(paths[0]).toEqual(
        path.join(
          opts.out!,
          generateFinalBasename({
            name: opts.name,
            platform: process.platform,
            arch: getHostArch(),
          }),
        ),
      );
      // Create a dummy file to detect whether the output directory is replaced in subsequent runs
      const testPath = path.join(paths[0], 'test.txt');
      await fs.writeFile(testPath, 'test');
      // Second run without overwrite should be skipped
      await packager(opts);
      expect(fs.existsSync(testPath)).toBe(true);
      // Third run with overwrite should replace the output directory
      await packager({ ...opts, overwrite: true });
      expect(fs.existsSync(testPath)).toBe(false);
    },
  );

  it('defaults the out directory to the current working directory', async ({
    baseOpts,
  }) => {
    const opts = {
      ...baseOpts,
      out: undefined,
    };
    const paths = await packager(opts);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(
      path.join(
        process.cwd(),
        generateFinalBasename({
          name: opts.name,
          platform: process.platform,
          arch: getHostArch(),
        }),
      ),
    );
    expect(paths[0]).toBeDirectory();
    await fs.rm(paths[0], { recursive: true, force: true });
  });

  it('can package with platform/arch set', async ({ baseOpts }) => {
    const opts: Options = {
      ...baseOpts,
      platform: 'linux',
      arch: 'x64',
    };

    const paths = await packager(opts);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(
      path.join(
        opts.out!,
        generateFinalBasename({
          platform: opts.platform as string,
          arch: opts.arch as string,
          name: opts.name,
        }),
      ),
    );
  });

  it('can package with tmpdir disabled', async ({ baseOpts }) => {
    const opts: Options = {
      ...baseOpts,
      tmpdir: false,
    };
    const paths = await packager(opts);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toBeDirectory();
  });

  it('preserves symlinks with derefSymlinks disabled', async ({ baseOpts }) => {
    const opts: Options = {
      ...baseOpts,
      derefSymlinks: false,
      platform: 'linux',
      arch: 'x64',
    };

    const src = path.join(opts.dir, 'main.js');
    const dest = path.join(opts.dir, 'main-link.js');
    await fs.symlink(src, dest);

    const paths = await packager(opts);
    expect(paths).toHaveLength(1);

    const destLink = path.join(paths[0], 'resources', 'app', 'main-link.js');
    expect(destLink).toBeSymlink();

    await fs.rm(dest, { force: true });
  });

  it.runIf(process.platform === 'darwin')(
    'can package for all target platforms at once',
    { timeout: 120_000 },
    async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        all: true,
      };
      const paths = await packager(opts);
      const base = paths.map((p) => path.basename(p));
      expect(base).toMatchInlineSnapshot(`
        [
          "packagerTest-win32-ia32",
          "packagerTest-darwin-x64",
          "packagerTest-linux-x64",
          "packagerTest-mas-x64",
          "packagerTest-win32-x64",
          "packagerTest-linux-armv7l",
          "packagerTest-darwin-arm64",
          "packagerTest-linux-arm64",
          "packagerTest-mas-arm64",
          "packagerTest-win32-arm64",
          "packagerTest-darwin-universal",
          "packagerTest-mas-universal",
        ]
      `);
    },
  );

  it.runIf(process.platform !== 'darwin')(
    'can package for all target platforms at once (no universal on non-darwin)',
    { timeout: 120_000 },
    async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        all: true,
      };
      const paths = await packager(opts);
      const base = paths.map((p) => path.basename(p));
      expect(base).toMatchInlineSnapshot(`
        [
          "packagerTest-win32-ia32",
          "packagerTest-darwin-x64",
          "packagerTest-linux-x64",
          "packagerTest-mas-x64",
          "packagerTest-win32-x64",
          "packagerTest-linux-armv7l",
          "packagerTest-darwin-arm64",
          "packagerTest-linux-arm64",
          "packagerTest-mas-arm64",
          "packagerTest-win32-arm64",
        ]
      `);
    },
  );

  describe.runIf(process.platform !== 'win32')('extraResource', () => {
    it('can package with extraResource string', async ({ baseOpts }) => {
      const extra1Base = 'data1.txt';
      const extra1Path = path.join(__dirname, 'fixtures', extra1Base);

      const opts: Options = {
        ...baseOpts,
        extraResource: extra1Path,
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);

      const resourcesPath = path.join(
        paths[0],
        generateResourcesPath({
          name: opts.name,
          platform: process.platform,
        }),
      );

      expect(fs.readFileSync(extra1Path, 'utf8')).toEqual(
        fs.readFileSync(path.join(resourcesPath, extra1Base), 'utf8'),
      );
    });

    it('can package with extraResource array', async ({ baseOpts }) => {
      const extra1Base = 'data1.txt';
      const extra2Base = 'extrainfo.plist';
      const extra1Path = path.join(__dirname, 'fixtures', extra1Base);
      const extra2Path = path.join(__dirname, 'fixtures', extra2Base);

      const opts: Options = {
        ...baseOpts,
        extraResource: [extra1Path, extra2Path],
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);

      const resourcesPath = path.join(
        paths[0],
        generateResourcesPath({
          name: opts.name,
          platform: process.platform,
        }),
      );

      expect(fs.readFileSync(extra1Path, 'utf8')).toEqual(
        fs.readFileSync(path.join(resourcesPath, extra1Base), 'utf8'),
      );

      expect(fs.readFileSync(extra2Path, 'utf8')).toEqual(
        fs.readFileSync(path.join(resourcesPath, extra2Base), 'utf8'),
      );
    });
  });

  describe.runIf(process.platform === 'linux')('Linux', async () => {
    it('sanitizes binary name', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        name: '@username/package-name',
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const binary = path.join(paths[0], '@username-package-name');
      expect(binary).toBeFile();
    });

    it('honours the executableName option', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        name: 'PackageName',
        executableName: 'my-package',
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const binary = path.join(paths[0], 'my-package');
      expect(binary).toBeFile();
    });
  });

  it('can package with dir: relative path', async ({ baseOpts }) => {
    const opts: Options = {
      ...baseOpts,
      name: 'relativePathTest',
      dir: path.join('.', 'test', 'fixtures', 'basic'), // dir is relative to process.cwd()
    };

    const paths = await packager(opts);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(
      path.join(
        opts.out!,
        generateFinalBasename({
          name: opts.name,
          platform: process.platform,
          arch: getHostArch(),
        }),
      ),
    );
  });

  describe('electronZipDir', () => {
    it('can package with electronZipDir', async ({ baseOpts }) => {
      const customDir = path.join(baseOpts.tmpdir as string, 'download');
      const opts: Options = {
        ...baseOpts,
        name: 'electronZipDirTest',
        electronZipDir: customDir,
        platform: 'linux',
        arch: 'x64',
      };
      await fs.ensureDir(customDir);
      const zipPath = await downloadElectronZip(
        createDownloadOpts(opts, 'linux', 'x64'),
      );
      await fs.copy(zipPath, path.join(customDir, path.basename(zipPath)));

      const paths = await packager(opts);

      expect(paths).toHaveLength(1);
      expect(paths[0]).toBeDirectory();
    });

    it('throws if electronZipDir does not exist', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        electronZipDir: path.join(baseOpts.tmpdir as string, 'does-not-exist'),
      };

      await expect(packager(opts)).rejects.toThrowError(
        'Electron ZIP directory does not exist',
      );
    });
  });

  describe('asar', () => {
    it('can package with asar', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        asar: { unpack: '*.pac', unpackDir: 'dir_to_unpack' },
      };

      const paths = await packager(opts);

      expect(paths).toHaveLength(1);
      expect(paths[0]).toBeDirectory();

      const resourcesPath = path.join(
        paths[0],
        generateResourcesPath({ name: opts.name, platform: process.platform }),
      );

      expect(fs.existsSync(path.join(resourcesPath, 'app'))).toBe(false);
      expect(fs.existsSync(path.join(resourcesPath, 'app.asar'))).toBe(true);
      expect(fs.existsSync(path.join(resourcesPath, 'app.asar.unpacked'))).toBe(
        true,
      );
      expect(
        fs.existsSync(
          path.join(resourcesPath, 'app.asar.unpacked', 'dir_to_unpack'),
        ),
      ).toBe(true);
    });

    it('ignores asar options if prebuiltAsar is set', async ({ baseOpts }) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const opts: Options = {
        ...baseOpts,
        dir: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
        prebuiltAsar: path.join(
          __dirname,
          'fixtures',
          'asar-prebuilt',
          'app.asar',
        ),
        asar: { unpack: '*.pac', unpackDir: 'dir_to_unpack' },
        ignore: ['foo'],
        prune: false,
        derefSymlinks: false,
      };

      const paths = await packager(opts);

      expect(paths).toHaveLength(1);
      expect(paths[0]).toBeDirectory();
      const resourcesPath = path.join(
        paths[0],
        generateResourcesPath({ name: opts.name, platform: process.platform }),
      );

      expect(fs.existsSync(path.join(resourcesPath, 'app'))).toBe(false);
      expect(fs.existsSync(path.join(resourcesPath, 'app.asar.unpacked'))).toBe(
        false,
      );
      expect(fs.existsSync(path.join(resourcesPath, 'app.asar'))).toBe(true);
      expect(
        fs.readFileSync(path.join(resourcesPath, 'app.asar'), 'utf8'),
      ).toEqual(
        fs.readFileSync(
          path.join(__dirname, 'fixtures', 'asar-prebuilt', 'app.asar'),
          'utf8',
        ),
      );

      expect(console.warn).toHaveBeenCalledWith(
        'WARNING: prebuiltAsar has been specified, all asar options will be ignored',
      );
      expect(console.warn).toHaveBeenCalledWith(
        'WARNING: prebuiltAsar and ignore are incompatible, ignoring the ignore option',
      );
      expect(console.warn).toHaveBeenCalledWith(
        'WARNING: prebuiltAsar and prune are incompatible, ignoring the prune option',
      );
      expect(console.warn).toHaveBeenCalledWith(
        'WARNING: prebuiltAsar and derefSymlinks are incompatible, ignoring the derefSymlinks option',
      );
    });

    it('throws if prebuiltAsar is a directory', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        dir: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
        prebuiltAsar: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
      };

      await expect(packager(opts)).rejects.toThrowError(
        'prebuiltAsar must be an asar file',
      );
    });
  });

  it('should ignore previously-packaged out dir', async ({ baseOpts }) => {
    const fixture = path.join(__dirname, 'fixtures', 'basic');
    const opts: Options = {
      ...baseOpts,
      name: 'ignoreOutDirTest',
      out: path.join(baseOpts.out!, 'out'),
    };

    await fs.copy(fixture, opts.out!, {
      dereference: true,
      filter: (file) => path.basename(file) !== 'node_modules',
    });

    await fs.ensureDir(opts.out!);
    await fs.writeFile(path.join(opts.out!, 'ignoreMe'), 'test');

    const [p] = await packager(opts);
    const resourcesPath = path.join(
      p,
      generateResourcesPath({ name: opts.name, platform: process.platform }),
    );
    expect(
      fs.existsSync(path.join(resourcesPath, 'app', path.basename(opts.out!))),
    ).toBe(false);
  });

  describe('hooks', () => {
    it.for([
      {
        testOpts: {},
        expectedOutput: [
          'afterFinalizePackageTargets',
          'afterExtract',
          'beforeCopy',
          'afterCopy',
          'afterPrune',
          'afterInitialize',
          'afterComplete',
        ],
      },
      {
        testOpts: { asar: true },
        expectedOutput: [
          'afterFinalizePackageTargets',
          'afterExtract',
          'beforeCopy',
          'afterCopy',
          'afterPrune',
          'afterAsar',
          'afterInitialize',
          'afterComplete',
        ],
      },
      {
        testOpts: { prune: false },
        expectedOutput: [
          'afterFinalizePackageTargets',
          'afterExtract',
          'beforeCopy',
          'afterCopy',
          'afterInitialize',
          'afterComplete',
        ],
      },
    ])(
      'runs expected hooks in order with options $testOpts',
      async ({ testOpts, expectedOutput }, { baseOpts }) => {
        const output: string[] = [];
        const opts: Options = {
          ...baseOpts,
          platform: 'darwin',
          arch: 'x64',
          afterAsar: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('afterAsar');
              callback();
            },
          ],
          afterCopy: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('afterCopy');
              callback();
            },
          ],
          afterComplete: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('afterComplete');
              callback();
            },
          ],
          afterCopyExtraResources: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('afterCopyExtraResources');
              callback();
            },
          ],
          afterExtract: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('afterExtract');
              callback();
            },
          ],
          afterFinalizePackageTargets: [
            (targets, callback) => {
              output.push('afterFinalizePackageTargets');
              expect(targets).toEqual([
                {
                  arch: 'x64',
                  platform: 'darwin',
                },
              ]);
              callback();
            },
          ],
          afterInitialize: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('afterInitialize');
              callback();
            },
          ],
          afterPrune: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('afterPrune');
              callback();
            },
          ],
          beforeCopy: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('beforeCopy');
              callback();
            },
          ],
          beforeCopyExtraResources: [
            (buildPath, electronVersion, platform, arch, callback) => {
              output.push('beforeCopyExtraResources');
              callback();
            },
          ],
          ...testOpts,
        };

        await packager(opts);
        expect(output).toEqual(expectedOutput);
      },
    );

    it.for([
      {
        hook: 'beforeCopy',
      },
      {
        hook: 'afterCopy',
      },
      {
        hook: 'afterPrune',
      },
    ])(
      'throws an error if prebuiltAsar and $hook is specified',
      async ({ hook }, { baseOpts }) => {
        const opts: Options = {
          ...baseOpts,
          dir: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
          prebuiltAsar: path.join(
            __dirname,
            'fixtures',
            'asar-prebuilt',
            'app.asar',
          ),
          [hook]: [
            (
              _: string,
              __: string,
              ___: string,
              ____: string,
              callback: () => void,
            ) => {
              callback();
            },
          ],
        };

        await expect(packager(opts)).rejects.toThrowError(
          `${hook} is incompatible with prebuiltAsar`,
        );
      },
    );
  });

  describe('prune', () => {
    it('should prune devDependencies and keep dependencies', async ({
      baseOpts,
    }) => {
      const opts: Options = {
        ...baseOpts,
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const resourcesPath = path.join(
        paths[0],
        generateResourcesPath({ name: opts.name, platform: process.platform }),
      );

      expect(
        fs.existsSync(
          path.join(resourcesPath, 'app', 'node_modules', 'run-series'),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(resourcesPath, 'app', 'node_modules', '@types', 'node'),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(resourcesPath, 'app', 'node_modules', 'run-waterfall'),
        ),
      ).toBe(false);
    });

    it('should prune electron in dependencies', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        dir: path.join(__dirname, 'fixtures', 'electron-in-dependencies'),
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const resourcesPath = path.join(
        paths[0],
        generateResourcesPath({ name: opts.name, platform: process.platform }),
      );

      expect(
        fs.existsSync(
          path.join(resourcesPath, 'app', 'node_modules', 'electron'),
        ),
      ).toBe(false);
    });
  });

  describe.runIf(process.platform === 'darwin')('macOS', () => {
    describe('icon', () => {
      const iconBase = path.join(__dirname, 'fixtures', 'monochrome');
      it.for(['.icns', '.ico', ''])(
        'can package an icon with "%s" extension',
        async (type, { baseOpts }) => {
          const opts = {
            ...baseOpts,
            icon: `${iconBase}${type}`,
          };

          const paths = await packager(opts);
          expect(paths).toHaveLength(1);
          const infoPlist = parseInfoPlist(paths[0]);
          const bundleIconPath = path.join(
            paths[0],
            `${opts.name}.app`,
            'Contents',
            'Resources',
            infoPlist.CFBundleIconFile as string,
          );
          expect(fs.existsSync(bundleIconPath)).toBe(true);

          // We replace all icon formats with .icns
          expect(fs.readFileSync(bundleIconPath, 'utf8')).toEqual(
            fs.readFileSync(path.join(`${iconBase}.icns`), 'utf8'),
          );
        },
      );

      it('skips icon packaging if icon path is invalid', async ({
        baseOpts,
      }) => {
        let expectedChecksum;
        const opts: Options = {
          ...baseOpts,
          icon: 'foo/bar/baz',
          afterExtract: [
            async (
              extractPath,
              _electronVersion,
              _platform,
              _arch,
              callback,
            ) => {
              const hash = crypto.createHash('sha256');
              hash.update(
                await fs.readFile(
                  path.join(
                    extractPath,
                    'Electron.app',
                    'Contents',
                    'Resources',
                    'electron.icns',
                  ),
                ),
              );
              expectedChecksum = hash.digest('hex');
              callback();
            },
          ],
        };

        const paths = await packager(opts);
        expect(paths).toHaveLength(1);
        const hash = crypto.createHash('sha256');
        hash.update(
          await fs.readFile(
            path.join(
              paths[0],
              `${opts.name}.app`,
              'Contents',
              'Resources',
              'electron.icns',
            ),
          ),
        );

        expect(hash.digest('hex')).toEqual(expectedChecksum);
      });
    });

    describe('extendInfo', () => {
      const extraInfoPath = path.join(__dirname, 'fixtures', 'extrainfo.plist');
      const extraInfoParams = plist.parse(
        fs.readFileSync(extraInfoPath).toString(),
      ) as PlistObject;
      it.for([
        { type: 'path', extraInfo: extraInfoPath },
        { type: 'object', extraInfo: extraInfoParams },
      ])('can package with extendInfo', async ({ extraInfo }, { baseOpts }) => {
        const opts: Options = {
          ...baseOpts,
          appBundleId: 'com.electron.extratest',
          appCategoryType: 'public.app-category.music',
          buildVersion: '3.2.1',
          extendInfo: extraInfo,
        };

        const paths = await packager(opts);
        const infoPlist = parseInfoPlist(paths[0]);
        expect(infoPlist.TestKeyString).toBe('String data');
        expect(infoPlist.TestKeyInt).toBe(12345);
        expect(infoPlist.TestKeyBool).toBe(true);
        expect(infoPlist.TestKeyArray).toEqual([
          'public.content',
          'public.data',
        ]);
        expect(infoPlist.TestKeyDict).toEqual({
          Number: 98765,
          CFBundleVersion: '0.0.0',
        });
        expect(infoPlist.CFBundleVersion).toBe(opts.buildVersion);
        expect(infoPlist.CFBundleIdentifier).toBe(opts.appBundleId);
        expect(infoPlist.LSApplicationCategoryType).toBe(opts.appCategoryType);
        expect(infoPlist.CFBundlePackageType).toBe('APPL');
      });
    });

    describe('extendHelperInfo', () => {
      const extraHelperInfoPath = path.join(
        __dirname,
        'fixtures',
        'extrainfo.plist',
      );
      const extraHelperInfoParams = plist.parse(
        fs.readFileSync(extraHelperInfoPath).toString(),
      ) as PlistObject;
      it.for([
        { type: 'path', extraHelperInfo: extraHelperInfoPath },
        { type: 'object', extraHelperInfo: extraHelperInfoParams },
      ])(
        'can package with extendHelperInfo',
        async ({ extraHelperInfo }, { baseOpts }) => {
          const opts: Options = {
            ...baseOpts,
            appBundleId: 'com.electron.extratest',
            buildVersion: '3.2.1',
            extendHelperInfo: extraHelperInfo,
          };

          const paths = await packager(opts);
          const helperInfoPlist = parseHelperInfoPlist(paths[0]);
          expect(helperInfoPlist.TestKeyString).toBe('String data');
          expect(helperInfoPlist.TestKeyInt).toBe(12345);
          expect(helperInfoPlist.TestKeyBool).toBe(true);
          expect(helperInfoPlist.TestKeyArray).toEqual([
            'public.content',
            'public.data',
          ]);
          expect(helperInfoPlist.TestKeyDict).toEqual({
            Number: 98765,
            CFBundleVersion: '0.0.0',
          });
          expect(helperInfoPlist.CFBundleVersion).toBe(opts.buildVersion);
          expect(helperInfoPlist.CFBundleIdentifier).toBe(
            `${opts.appBundleId}.helper`,
          );
          expect(helperInfoPlist.CFBundlePackageType).toBe('APPL');
        },
      );
    });

    it('can enable dark mode support in macOS Mojave', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        darwinDarkModeSupport: true,
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const infoPlist = parseInfoPlist(paths[0]);
      expect(infoPlist.NSRequiresAquaSystemAppearance).toBe(false);
    });

    it('can pass protocol schemes to the Info.plist', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        protocols: [
          {
            name: 'Foo',
            schemes: ['foo'],
          },
          {
            name: 'Bar',
            schemes: ['bar', 'baz'],
          },
        ],
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const infoPlist = parseInfoPlist(paths[0]);
      expect(infoPlist.CFBundleURLTypes).toEqual([
        {
          CFBundleURLName: 'Foo',
          CFBundleURLSchemes: ['foo'],
        },
        {
          CFBundleURLName: 'Bar',
          CFBundleURLSchemes: ['bar', 'baz'],
        },
      ]);
    });

    describe('executable name', () => {
      it.for([
        {
          type: 'name',
          testOpts: {
            name: 'myName',
          },
          expectedAppName: 'myName',
          expectedExecutableName: 'myName',
        },
        {
          type: 'name with slashes',
          testOpts: {
            name: '@username/package-name',
          },
          expectedAppName: '@username-package-name',
          expectedExecutableName: '@username-package-name',
        },
        {
          type: 'name and executableName',
          testOpts: {
            name: 'myName',
            executableName: 'myExecutableName',
          },
          expectedAppName: 'myName',
          expectedExecutableName: 'myExecutableName',
        },
      ])(
        'names the executable correctly with $type',
        async (
          {
            testOpts,
            expectedAppName: expectedAppName,
            expectedExecutableName,
          },
          { baseOpts },
        ) => {
          const opts: Options = {
            ...baseOpts,
            ...testOpts,
          };

          const paths = await packager(opts);
          expect(paths).toHaveLength(1);
          const binaryPath = path.join(
            paths[0],
            `${expectedAppName}.app`,
            'Contents',
            'MacOS',
            expectedExecutableName,
          );
          expect(binaryPath).toBeFile();
        },
      );

      it('sets the correct Info.plist values', async ({ baseOpts }) => {
        const appBundleIdentifier = 'com.electron.username-package-name';
        const expectedSanitizedName = '@username-package-name';

        const opts: Options = {
          ...baseOpts,
          name: '@username/package-name',
        };

        const paths = await packager(opts);
        expect(paths).toHaveLength(1);
        const infoPlist = parseInfoPlist(paths[0]);

        // CFBundleName is the sanitized app name and CFBundleDisplayName is the non-sanitized app name
        expect(infoPlist.CFBundleDisplayName).toBe(opts.name);
        expect(infoPlist.CFBundleName).toBe(expectedSanitizedName);
        expect(infoPlist.CFBundleIdentifier).toBe(appBundleIdentifier);
      });
    });

    it.for([
      {
        appVersion: '1.0.0',
        buildVersion: '1.0.0.1234',
      },
      {
        appVersion: 12,
        buildVersion: 1234,
      },
      {
        appVersion: '1.0.0',
      },
      {},
    ])(
      'sets the correct Info.plist values for the app version',
      async (testOpts, { baseOpts }) => {
        // @ts-expect-error - integers aren't valid according to the types?
        const opts: Options = {
          ...baseOpts,
          ...testOpts,
        };

        const paths = await packager(opts);
        expect(paths).toHaveLength(1);
        const infoPlist = parseInfoPlist(paths[0]);
        expect(infoPlist.CFBundleVersion).toBe(
          String(opts.buildVersion ?? opts.appVersion ?? '4.99.101'),
        );
        expect(infoPlist.CFBundleShortVersionString).toBe(
          String(opts.appVersion ?? '4.99.101'),
        );
      },
    );

    it('sets the correct Info.plist values for the appCategoryType', async ({
      baseOpts,
    }) => {
      const opts: Options = {
        ...baseOpts,
        appCategoryType: 'public.app-category.developer-tools',
      };
      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const infoPlist = parseInfoPlist(paths[0]);
      expect(infoPlist.LSApplicationCategoryType).toBe(opts.appCategoryType);
    });

    describe('appBundleId', () => {
      it.for([
        'com.electron.app-test',
        'com.electron."bãśè tëßt!@#$%^&*()?\'',
        undefined,
      ])(
        'sets the correct app Info.plist values for appBundleId value %s',
        async (appBundleId, { baseOpts }) => {
          const opts: Options = {
            ...baseOpts,
            appBundleId,
          };

          const defaultBundleName = `com.electron.${opts.name!.toLowerCase()}`;
          const appBundleIdentifier = filterCFBundleIdentifier(
            opts.appBundleId ?? defaultBundleName,
          );

          const paths = await packager(opts);
          expect(paths).toHaveLength(1);
          const infoPlist = parseInfoPlist(paths[0]);
          expect(infoPlist.CFBundleIdentifier).toBe(appBundleIdentifier);
        },
      );

      it.for([
        {
          testOpts: {
            helperBundleId: 'com.electron.app-test.helper',
          },
          expectedHelperBundleId: 'com.electron.app-test.helper',
        },
        {
          testOpts: {
            appBundleId: 'com.electron.app-test',
          },
          expectedHelperBundleId: 'com.electron.app-test.helper',
        },
      ])(
        'sets the correct legacy helper Info.plist values for $testOpts',
        async ({ testOpts, expectedHelperBundleId }, { baseOpts }) => {
          const opts: Options = {
            ...baseOpts,
            electronVersion: '1.4.13',
            arch: 'x64',
            platform: 'darwin',
            ...testOpts,
          };

          const paths = await packager(opts);
          expect(paths).toHaveLength(1);

          const plistPath = path.join(
            paths[0],
            `${opts.name}.app`,
            'Contents',
            'Frameworks',
            `${opts.name} Helper NP.app`,
            'Contents',
            'Info.plist',
          );
          const infoPlist = plist.parse(
            fs.readFileSync(plistPath, 'utf8'),
          ) as PlistObject;
          expect(infoPlist.CFBundleIdentifier).toBe(
            `${expectedHelperBundleId}.NP`,
          );
          expect(infoPlist.CFBundleName).toBe(`${opts.name} Helper NP`);
          expect(infoPlist.CFBundleDisplayName).toBe(`${opts.name} Helper NP`);
          expect(infoPlist.CFBundleExecutable).toBe(`${opts.name} Helper NP`);
        },
      );

      it.for([
        {
          testOpts: {
            helperBundleId: 'com.electron.app-test.helper',
          },
          expectedHelperBundleId: 'com.electron.app-test.helper',
        },
        {
          testOpts: {
            appBundleId: 'com.electron.app-test',
          },
          expectedHelperBundleId: 'com.electron.app-test.helper',
        },
      ])(
        'sets the correct helper Info.plist values for $testOpts',
        async ({ testOpts, expectedHelperBundleId }, { baseOpts }) => {
          const opts: Options = {
            ...baseOpts,
            ...testOpts,
          };

          const paths = await packager(opts);
          expect(paths).toHaveLength(1);

          const helperPlist = parseHelperInfoPlist(paths[0]);
          expect(helperPlist.CFBundleIdentifier).toBe(expectedHelperBundleId);
          expect(helperPlist.CFBundleName).toBe(`${opts.name}`);

          for (const helperType of ['GPU', 'Renderer', 'Plugin'] as const) {
            const helperPlist = parseHelperInfoPlist(paths[0], helperType);
            expect(helperPlist.CFBundleName).toBe(
              `${opts.name} Helper (${helperType})`,
            );
            expect(helperPlist.CFBundleExecutable).toBe(
              `${opts.name} Helper (${helperType})`,
            );
            expect(helperPlist.CFBundleIdentifier).toBe(
              `${expectedHelperBundleId}`,
            );
          }
        },
      );
    });

    it('symlinks frameworks', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);

      const frameworkPath = path.join(
        paths[0],
        `${opts.name}.app`,
        'Contents',
        'Frameworks',
        'Electron Framework.framework',
      );

      expect(frameworkPath).toBeDirectory();
      expect(path.join(frameworkPath, 'Electron Framework')).toBeSymlink();
      expect(path.join(frameworkPath, 'Versions', 'Current')).toBeSymlink();
    });

    it('does not handle EH and NP helpers for modern Electron versions', async ({
      baseOpts,
    }) => {
      const helpers = ['Helper EH', 'Helper NP'];
      const helperPaths: string[] = [];
      const opts: Options = {
        ...baseOpts,
        afterExtract: [
          (buildPath, _electronVersion, _platform, _arch, cb) => {
            return Promise.all(
              helpers.map(async (helper) => {
                const helperPath = path.join(
                  buildPath,
                  `${opts.name}.app`,
                  'Contents',
                  'Frameworks',
                  `${opts.name} ${helper}.app`,
                );
                helperPaths.push(helperPath);
                await fs.rm(helperPath, {
                  recursive: true,
                  force: true,
                });
                cb();
              }),
            );
          },
        ],
      };

      await packager(opts);
      for (const helperPath of helperPaths) {
        expect(fs.existsSync(helperPath)).toBe(false);
      }
    });

    it('maps appCopyright to NSHumanReadableCopyright', async ({
      baseOpts,
    }) => {
      const opts: Options = {
        ...baseOpts,
        appCopyright:
          'Copyright © 2013–2025 Organization. All rights reserved.',
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const infoPlist = parseInfoPlist(paths[0]);
      expect(infoPlist.NSHumanReadableCopyright).toBe(opts.appCopyright);
    });

    it('maps usageDescription to the correct keys', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        usageDescription: {
          Microphone: 'I am a Karaoke app',
        },
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const infoPlist = parseInfoPlist(paths[0]);
      expect(infoPlist.NSMicrophoneUsageDescription).toBe(
        opts.usageDescription!.Microphone,
      );
    });

    it('can package an app named Electron', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        name: 'Electron',
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const appPath = path.join(paths[0], 'Electron.app');
      expect(appPath).toBeDirectory();
      expect(path.join(appPath, 'Contents', 'MacOS', 'Electron')).toBeFile();
    });

    describe('asar integrity hashes', () => {
      it('does not insert hashes when asar is disabled', async ({
        baseOpts,
      }) => {
        const opts: Options = {
          ...baseOpts,
          asar: false,
        };

        const paths = await packager(opts);
        expect(paths).toHaveLength(1);
        const infoPlist = parseInfoPlist(paths[0]);
        expect(infoPlist.ElectronAsarIntegrity).toBeUndefined();
      });

      it('inserts hashes when asar is enabled', async ({ baseOpts }) => {
        const opts: Options = {
          ...baseOpts,
          asar: true,
        };

        const paths = await packager(opts);
        expect(paths).toHaveLength(1);
        const infoPlist = parseInfoPlist(paths[0]);
        expect(infoPlist.ElectronAsarIntegrity).toEqual({
          'Resources/app.asar': {
            algorithm: 'SHA256',
            hash: 'f4a18a4219d839f07a75a4e93d18f410b020d339c4fe8b5b25a9b380515ef71c',
          },
        });
      });

      it('inserts hashes when prebuilt asar is used', async ({ baseOpts }) => {
        const opts: Options = {
          ...baseOpts,
          dir: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
          prebuiltAsar: path.join(
            __dirname,
            'fixtures',
            'asar-prebuilt',
            'app.asar',
          ),
        };

        const paths = await packager(opts);
        expect(paths).toHaveLength(1);
        const infoPlist = parseInfoPlist(paths[0]);
        expect(infoPlist.ElectronAsarIntegrity).toEqual({
          'Resources/app.asar': {
            algorithm: 'SHA256',
            hash: '5efe069acf1f8d2622f2da149fcedcd5e17f9e7f4bc6f7ffe89255ee96647d4f',
          },
        });
      });
    });

    describe('codesign', () => {
      it('can sign the app', { timeout: 60_000 }, async ({ baseOpts }) => {
        const opts: Options = {
          ...baseOpts,
          osxSign: { identity: 'codesign.electronjs.org' },
        };

        const [finalPath] = await packager(opts);
        const appPath = path.join(finalPath, `${opts.name}.app`);
        expect(appPath).toBeDirectory();
        await expect(
          util.promisify(exec)(`codesign --verify --verbose ${appPath}`),
        ).resolves.toEqual(expect.anything());
      });
    });

    describe('Mac App Store', () => {
      it('can package for MAS', async ({ baseOpts }) => {
        const opts: Options = {
          ...baseOpts,
          name: 'masTest',
          arch: 'x64',
          platform: 'mas',
        };

        const paths = await packager(opts);
        expect(paths).toHaveLength(1);

        expect(console.warn).toHaveBeenCalledWith(
          'WARNING: signing is required for mas builds. Provide the osx-sign option, or manually sign the app later.',
        );

        const helperName = `${opts.name} Login Helper`;
        const helperPath = path.join(
          paths[0],
          `${opts.name}.app`,
          'Contents',
          'Library',
          'LoginItems',
          `${helperName}.app`,
        );

        expect(helperPath).toBeDirectory();
        const plistPath = path.join(helperPath, 'Contents', 'Info.plist');
        const plistData = plist.parse(
          fs.readFileSync(plistPath, 'utf8'),
        ) as PlistObject;
        expect(plistData.CFBundleExecutable).toBe(helperName);
        expect(plistData.CFBundleName).toBe(helperName);
        expect(plistData.CFBundleIdentifier).toBe(
          'com.electron.mastest.loginhelper',
        );

        const contentsPath = path.join(helperPath, 'Contents');
        expect(path.join(contentsPath, 'MacOS', helperName)).toBeFile();
      });
    });
  });

  describe.runIf(process.platform === 'win32')('Windows', () => {
    it('sanitizes the executable name', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        name: '@username/package-name',
        platform: 'win32',
        arch: 'x64',
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const exePath = path.join(paths[0], `@username-package-name.exe`);
      expect(exePath).toBeFile();
    });

    it('uses the executableName option', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        name: '@username/package-name',
        executableName: 'my-app-executable',
        platform: 'win32',
        arch: 'x64',
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const exePath = path.join(paths[0], `my-app-executable.exe`);
      expect(exePath).toBeFile();
    });

    it('sets an icon', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        name: 'icon-test',
        icon: path.join(__dirname, 'fixtures', 'icon.ico'),
        platform: 'win32',
        arch: 'x64',
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const exePath = path.join(paths[0], `icon-test.exe`);
      expect(exePath).toBeFile();
    });

    it('sets the correct metadata in the exe', async ({ baseOpts }) => {
      const opts: Options = {
        ...baseOpts,
        name: 'versionInfoTest',
        platform: 'win32',
        arch: 'x64',
        appVersion: '1.2.3',
        buildVersion: '4.5.6',
        win32metadata: { 'requested-execution-level': 'requireAdministrator' },
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);

      const resedit = await dynamicImport('resedit');
      const exe = (resedit.NtExecutable as typeof NtExecutable).from(
        await fs.readFile(path.join(paths[0], 'versionInfoTest.exe')),
      );
      const res = (
        resedit.NtExecutableResource as typeof NtExecutableResource
      ).from(exe);

      const manifest = res.entries.find((e) => e.type === 24)!;
      const manifestString = Buffer.from(manifest.bin).toString('utf-8');
      expect(manifestString).toContain('requireAdministrator');

      const versionInfo = resedit.Resource.VersionInfo.fromEntries(res.entries);
      expect(versionInfo.length).toBe(1);
      const version = versionInfo[0];
      const langs = version.getAllLanguagesForStringValues();
      expect(langs.length).toBe(1);
      expect(version.getStringValues(langs[0]).FileVersion).toBe('4.5.6');
      expect(version.getStringValues(langs[0]).ProductVersion).toBe('1.2.3');
    });
  });
});
