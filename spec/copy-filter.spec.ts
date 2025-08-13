import {
  generateIgnoredOutDirs,
  populateIgnoredPaths,
  userPathFilter,
} from '../src/copy-filter';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ComboOptions, Options } from '../src';

describe('populateIgnoredPaths', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-'),
    );
  });

  it('ignores the generated temporary directory only on Linux', () => {
    const tmpdir = '/foo/bar';
    const expected = path.join(tmpdir, 'electron-packager');
    const opts = { tmpdir } as Options;

    populateIgnoredPaths(opts);

    if (process.platform === 'linux') {
      expect(opts.ignore).toContain(expected);
    } else {
      expect(opts.ignore).not.toContain(expected);
    }
  });

  it('ignores certain files by default', async () => {
    const opts = {
      name: 'test',
      dir: path.join(__dirname, 'fixtures', 'basic'),
    } as Options;

    populateIgnoredPaths(opts);
    const targetDir = path.join(tempDir, 'result');
    await fs.copy(opts.dir, targetDir, {
      dereference: false,
      filter: userPathFilter(opts as ComboOptions),
    });

    expect(fs.existsSync(path.join(targetDir, 'node_gyp_bins'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'ignore.o'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'ignore.obj'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'package-lock.json'))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(targetDir, 'yarn.lock'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'Thumbs.db'))).toBe(false);

    // Random txt files should not be ignored
    expect(fs.existsSync(path.join(targetDir, 'ignorethis.txt'))).toBe(true);
  });
});

describe('userPathFilter', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-'),
    );
  });
  it.each([
    ['string', 'ignorethis'],
    ['string in array', ['ignorethis']],
    ['RegExp', /ignorethis/],
    ['Function', (file: string) => file.match(/ignorethis/)],
  ])('ignores %s that match the ignore pattern', async (_, ignore) => {
    const opts = {
      name: 'test',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      ignore: ignore,
    } as Options;

    populateIgnoredPaths(opts);
    const targetDir = path.join(tempDir, 'result');
    await fs.copy(opts.dir, targetDir, {
      dereference: false,
      filter: userPathFilter(opts as ComboOptions),
    });

    expect(fs.existsSync(path.join(targetDir, 'ignorethis.txt'))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, 'ignore', 'this.txt'))).toBe(
      true,
    );
  });

  it('parses slashes in the ignore pattern', async () => {
    const opts = {
      name: 'test',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      ignore: ['ignore/this'],
    } as Options;

    populateIgnoredPaths(opts);
    const targetDir = path.join(tempDir, 'result');
    await fs.copy(opts.dir, targetDir, {
      dereference: false,
      filter: userPathFilter(opts as ComboOptions),
    });

    expect(fs.existsSync(path.join(targetDir, 'ignorethis.txt'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'ignore', 'this.txt'))).toBe(
      false,
    );
  });

  it('only ignores files within the app directory', async () => {
    const opts = {
      name: 'test',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      // we're testing to see that not all files are ignored from the source dir if a parent directory is in the ignore list
      ignore: [__dirname],
    } as Options;

    populateIgnoredPaths(opts);

    const targetDir = path.join(tempDir, 'result');
    await fs.copy(opts.dir, targetDir, {
      dereference: false,
      filter: userPathFilter(opts as ComboOptions),
    });

    expect(fs.existsSync(path.join(targetDir, 'package.json'))).toBe(true);
  });

  it.each([
    ['junk: true', true],
    ['junk: false', false],
  ])('respects %s', async (_, junk) => {
    const opts = {
      name: 'test',
      dir: path.join(__dirname, 'fixtures', 'ignore-junk'),
      junk,
    } as Options;

    populateIgnoredPaths(opts);

    const targetDir = path.join(tempDir, 'result');
    await fs.copy(opts.dir, targetDir, {
      dereference: false,
      filter: userPathFilter(opts as ComboOptions),
    });

    expect(fs.existsSync(path.join(targetDir, 'subfolder', 'Thumbs.db'))).toBe(
      !junk,
    );
  });
});

describe('generateIgnoredOutDirs', () => {
  it('ignores all possible platform/arch permutations', () => {
    const ignores = generateIgnoredOutDirs({ name: 'test' } as ComboOptions);
    expect(ignores.length).toBe(14);
  });
});

// test.serial(
//   'ignore out dir',
//   util.testSinglePlatform(ignoreOutDirTest, 'ignoredOutDir'),
// );
// test.serial(
//   'ignore out dir: unnormalized path',
//   util.testSinglePlatform(ignoreOutDirTest, './ignoredOutDir'),
// );
// test.serial(
//   'ignore out dir: implicit path',
//   util.testSinglePlatform(async (t, opts) => {
//     opts.dir = t.context.workDir;
//     opts.name = 'ignoreImplicitOutDirTest';
//     delete opts.out;

//     const testFilename = 'ignoreMe';
//     const previousPackedResultDir = path.join(
//       opts.dir,
//       `${sanitizeAppName(opts.name)}-linux-ia32`,
//     );

//     return assertOutDirIgnored(
//       t,
//       opts,
//       previousPackedResultDir,
//       path.join(previousPackedResultDir, testFilename),
//       testFilename,
//     );
//   }),
// );
// test.serial(
//   'ignore out dir: relative out dir already exists',
//   util.testSinglePlatform(async (t, opts) => {
//     const oldCWD = process.cwd();
//     const appDir = path.join(t.context.workDir, 'app');

//     opts.name = 'ignoredOutDirTest';
//     opts.dir = '.';
//     opts.out = 'dir_to_unpack'; // already existing out dir
//     opts.overwrite = true;

//     await fs.copy(util.fixtureSubdir('basic'), appDir);
//     process.chdir(appDir);
//     const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts);
//     process.chdir(oldCWD);
//     const packagedOutDirPath = path.join(resourcesPath, 'app', opts.out);
//     await util.assertPathNotExists(
//       t,
//       packagedOutDirPath,
//       `The out dir ${packagedOutDirPath} should not exist in the packaged app`,
//     );
//   }),
// );
