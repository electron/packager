import { describe, it, expect, beforeEach } from 'vitest';
import { packager } from '../src/packager';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { generateFinalBasename } from '../src/common';
import { getHostArch } from '@electron/get';
import { generateNamePath, generateResourcesPath } from './utils';
import { Options } from '../src';

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
      arch: 'x64',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      name: 'Bad Helper',
      platform: 'linux',
    };

    await expect(packager(opts)).rejects.toThrowError(
      'Application names cannot end in " Helper" due to limitations on macOS',
    );
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
});
