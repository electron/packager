import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { getMetadataFromPackageJSON } from '../src/infer';
import { Options } from '../src/types';
import semver from 'semver';
import config from './config.json';

describe('getMetadataFromPackageJSON', () => {
  it.each([
    ['electron-nightly', 'infer-electron-nightly'],
    ['electron', 'infer-missing-version-only'],
  ])('infers the electron version from %s', async (packageName, fixture) => {
    const dir = path.join(__dirname, 'fixtures', fixture);
    const opts: Options = {
      dir,
    };
    const packageJSON = await import(path.join(dir, 'package.json'));
    await getMetadataFromPackageJSON([], opts, opts.dir);
    expect(opts.electronVersion).toBeDefined();
    expect(
      semver.satisfies(
        opts.electronVersion!,
        packageJSON.devDependencies[packageName],
      ),
    ).toBe(true);
  });

  describe('win32metadata', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'infer-test-'));
      await fs.copy(
        path.join(__dirname, 'fixtures', 'infer-win32metadata'),
        tempDir,
      );

      return async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
      };
    });

    it('infers win32metadata', async () => {
      const opts: Options = {
        electronVersion: config.version,
        dir: tempDir,
      };
      await getMetadataFromPackageJSON(['win32'], opts, opts.dir);
      expect(opts.win32metadata).toEqual({ CompanyName: 'Foo Bar' });
    });

    it('does not infer win32metadata if it already exists', async () => {
      const opts: Options = {
        electronVersion: config.version,
        dir: tempDir,
        win32metadata: {
          CompanyName: 'Existing',
        },
      };
      await getMetadataFromPackageJSON(['win32'], opts, opts.dir);
      expect(opts.win32metadata).toEqual({ CompanyName: 'Existing' });
    });

    it('infers win32metadata when author is an object with a name', async () => {
      const packageJSON = await fs.readJson(path.join(tempDir, 'package.json'));

      packageJSON.author = {
        name: 'Jane Doe',
        email: 'jdoe@example.com',
      };

      await fs.writeJson(path.join(tempDir, 'package.json'), packageJSON);

      const opts: Options = {
        dir: tempDir,
        electronVersion: config.version,
      };

      await getMetadataFromPackageJSON(['win32'], opts, opts.dir);
      expect(opts.win32metadata).toEqual({ CompanyName: 'Jane Doe' });
    });

    it('does not infer win32metadata when author is an object without a name', async () => {
      const packageJSON = await fs.readJson(path.join(tempDir, 'package.json'));

      packageJSON.author = {
        email: 'jdoe@example.com',
      };

      await fs.writeJson(path.join(tempDir, 'package.json'), packageJSON);

      const opts: Options = {
        dir: tempDir,
        electronVersion: config.version,
      };

      await getMetadataFromPackageJSON(['win32'], opts, opts.dir);
      expect(opts.win32metadata).toEqual({});
    });

    it('throws if no author is provided', async () => {
      const packageJSON = await fs.readJson(path.join(tempDir, 'package.json'));
      delete packageJSON.author;

      await fs.writeJson(path.join(tempDir, 'package.json'), packageJSON);
      const opts: Options = {
        dir: tempDir,
        appVersion: '1.0.0'
      };
      await expect(
        getMetadataFromPackageJSON(['win32'], opts, opts.dir),
      ).rejects.toThrow(Error);
    });
  });

  describe('failure cases', () => {
    let tempDir: string;
    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'infer-test-'));

      return async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
      };
    });

    it.each([
      ['package.json missing', 'infer-missing-package-json'],
      ['name missing', 'infer-missing-name'],
      ['has bad fields', 'infer-bad-fields'],
      ['electronVersion missing', 'infer-missing-electron-version'],
      ['malformed JSON', 'infer-malformed-json'],
    ])('throws if %s', async (_prop, fixture) => {
      await fs.copy(path.join(__dirname, 'fixtures', fixture), tempDir);
      const opts: Options = {
        dir: tempDir,
        name: 'MainJS',
      };
      await expect(
        getMetadataFromPackageJSON([], opts, opts.dir),
      ).rejects.toThrow(Error);
    });
  });
});
