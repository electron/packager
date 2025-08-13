import { describe, it, expect, beforeEach } from 'vitest';
import { packager } from '../src/packager';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { generateFinalBasename } from '../src/common';
import { getHostArch } from '@electron/get';
import { generateNamePath, generateResourcesPath } from './utils';
import { Options } from '../src';
import { createDownloadOpts, downloadElectronZip } from '../src/download';

describe('packager', () => {
  let workDir: string;
  let tmpDir: string;

  beforeEach(async () => {
    workDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-'),
    );
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-'),
    );

    return async () => {
      await fs.rm(workDir, { recursive: true, force: true });
      await fs.rm(tmpDir, { recursive: true, force: true });
    };
  });

  it('cannot build apps where the name ends in "Helper"', async () => {
    const opts: Options = {
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'Bad Helper',
    };

    await expect(packager(opts)).rejects.toThrowError(
      'Application names cannot end in " Helper" due to limitations on macOS',
    );
  });

  it('cannot build with invalid version', async () => {
    const opts: Options = {
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'invalidElectronTest',
      electronVersion: '0.0.1',
      platform: 'linux',
      arch: 'x64',
    };

    await expect(packager(opts)).rejects.toThrow(expect.any(Error));
  });

  it('packages with defaults', async () => {
    const opts: Options = {
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'defaultsTest',
      out: workDir,
      tmpdir: tmpDir,
    };

    const defaultOpts = {
      arch: getHostArch(),
      name: opts.name,
      platform: process.platform,
    };

    const paths = await packager(opts);
    expect(paths).toHaveLength(1);

    expect(paths[0]).toEqual(
      path.join(workDir, generateFinalBasename(defaultOpts)),
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

  it('can overwrite older packages', async () => {
    const opts: Options = {
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'overwriteTest',
      out: workDir,
      tmpdir: tmpDir,
    };

    const paths = await packager(opts);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(
      path.join(
        workDir,
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
  });

  it('defaults the out directory to the current working directory', async () => {
    const opts = {
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'cwdTest',
      tmpdir: tmpDir,
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

  it('can package with platform/arch set', async () => {
    const opts: Options = {
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'platformArchTest',
      out: workDir,
      tmpdir: tmpDir,
      platform: 'linux',
      arch: 'x64',
    };

    const paths = await packager(opts);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(
      path.join(
        workDir,
        generateFinalBasename({
          platform: opts.platform as string,
          arch: opts.arch as string,
          name: opts.name,
        }),
      ),
    );
  });

  it('can package with tmpdir disabled', async () => {
    const opts: Options = {
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'tmpdirTest',
      out: workDir,
      tmpdir: false,
    };
    const paths = await packager(opts);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toBeDirectory();
  });

  it('preserves symlinks with derefSymlinks disabled', async () => {
    const opts: Options = {
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'derefSymlinksTest',
      out: workDir,
      tmpdir: tmpDir,
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
    const file = await fs.lstat(destLink);
    expect(file.isSymbolicLink()).toBe(true);

    await fs.rm(dest, { force: true });
  });

  it.todo('can package for all target platforms at once');

  it.todo('fails with invalid arch');
  it.todo('fails with invalid platform');

  describe.runIf(process.platform !== 'win32')('extraResource', () => {
    it('can package with extraResource string', async () => {
      const extra1Base = 'data1.txt';
      const extra1Path = path.join(__dirname, 'fixtures', extra1Base);

      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'basic'),
        name: 'extraResourceTest',
        out: workDir,
        tmpdir: tmpDir,
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

    it('can package with extraResource array', async () => {
      const extra1Base = 'data1.txt';
      const extra2Base = 'extrainfo.plist';
      const extra1Path = path.join(__dirname, 'fixtures', extra1Base);
      const extra2Path = path.join(__dirname, 'fixtures', extra2Base);

      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'basic'),
        name: 'extraResourceTest',
        out: workDir,
        tmpdir: tmpDir,
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
    it('sanitizes binary name', async () => {
      const opts: Options = {
        name: '@username/package-name',
        dir: path.join(__dirname, 'fixtures', 'basic'),
        out: workDir,
        tmpdir: tmpDir,
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const binary = path.join(paths[0], '@username-package-name');
      expect(binary).toBeFile();
    });

    it('honours the executableName option', async () => {
      const opts: Options = {
        name: 'PackageName',
        executableName: 'my-package',
        dir: path.join(__dirname, 'fixtures', 'basic'),
        out: workDir,
        tmpdir: tmpDir,
      };

      const paths = await packager(opts);
      expect(paths).toHaveLength(1);
      const binary = path.join(paths[0], 'my-package');
      expect(binary).toBeFile();
    });
  });

  it('can package with dir: relative path', async () => {
    const opts: Options = {
      dir: path.join('.', 'spec', 'fixtures', 'basic'), // dir is relative to process.cwd()
      name: 'relativePathTest',
      out: workDir,
      tmpdir: tmpDir,
    };

    const paths = await packager(opts);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(
      path.join(
        workDir,
        generateFinalBasename({
          name: opts.name,
          platform: process.platform,
          arch: getHostArch(),
        }),
      ),
    );
  });

  describe('electronZipDir', () => {
    it('can package with electronZipDir', async () => {
      const customDir = path.join(tmpDir, 'download');
      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'basic'),
        name: 'electronZipDirTest',
        electronZipDir: customDir,
        out: workDir,
        tmpdir: tmpDir,
        platform: 'linux',
        arch: 'x64',
        electronVersion: '27.0.0',
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

    it('throws if electronZipDir does not exist', async () => {
      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'basic'),
        name: 'electronZipDirTest',
        electronZipDir: path.join(tmpDir, 'does-not-exist'),
        out: workDir,
        tmpdir: tmpDir,
        platform: 'linux',
        arch: 'x64',
        electronVersion: '27.0.0',
      };

      await expect(packager(opts)).rejects.toThrowError(
        'Electron ZIP directory does not exist',
      );
    });
  });

  describe('asar', () => {
    it('can package with asar', async () => {
      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'basic'),
        name: 'asarTest',
        out: workDir,
        tmpdir: tmpDir,
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

    it('ignores asar options if prebuiltAsar is set', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
        prebuiltAsar: path.join(
          __dirname,
          'fixtures',
          'asar-prebuilt',
          'app.asar',
        ),
        name: 'prebuiltAsarTest',
        out: workDir,
        tmpdir: tmpDir,
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

    it('throws if prebuiltAsar is a directory', async () => {
      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
        prebuiltAsar: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
        name: 'prebuiltAsarTest',
        out: workDir,
        tmpdir: tmpDir,
      };

      await expect(packager(opts)).rejects.toThrowError(
        'prebuiltAsar must be an asar file',
      );
    });

    it('throws if prebuiltAsar is true and afterCopy is specified', async () => {
      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
        prebuiltAsar: path.join(
          __dirname,
          'fixtures',
          'asar-prebuilt',
          'app.asar',
        ),
        name: 'prebuiltAsarTest',
        out: workDir,
        tmpdir: tmpDir,
        afterCopy: [],
      };

      await expect(packager(opts)).rejects.toThrowError(
        'afterCopy is incompatible with prebuiltAsar',
      );
    });

    it('throws if prebuiltAsar is true and afterPrune is specified', async () => {
      const opts: Options = {
        dir: path.join(__dirname, 'fixtures', 'asar-prebuilt'),
        prebuiltAsar: path.join(
          __dirname,
          'fixtures',
          'asar-prebuilt',
          'app.asar',
        ),
        name: 'prebuiltAsarTest',
        out: workDir,
        tmpdir: tmpDir,
        afterPrune: [],
      };

      await expect(packager(opts)).rejects.toThrowError(
        'afterPrune is incompatible with prebuiltAsar',
      );
    });
  });

  describe('out dir', () => {
    it.todo('should ignore the out dir');
    it.todo('should ignore the out dir (unnormalized path)');
    it.todo('should ignore the out dir (implicit path)');
    it.todo('should ignore the out dir (already exists)');
  });
  describe.todo('hooks', () => {
    it.todo('can package with afterCopy');
    it.todo('can package with afterPrune');
    it.todo('can package with afterBuild');
    it.todo('can package with afterExtract');
    it.todo('can package with afterSign');
    it.todo('can package with afterBuild');
    it.todo('can package with afterExtract');
  });

  describe.todo('prune');
});
