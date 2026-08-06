import { createDownloadOpts, downloadElectronZip } from '../src/download.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractElectronZip } from '../src/unzip.js';
import config from './config.json' with { type: 'json' };
import { describe, it, expect, beforeEach } from 'vitest';

describe('extractElectronZip', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'electron-packager-test-'));

    return async () => {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    };
  });

  it('extractElectronZip preserves symbolic links', async () => {
    const downloadOpts = createDownloadOpts(
      {
        electronVersion: config.version,
        dir: path.join(__dirname, 'fixtures', 'basic'),
      },
      'darwin',
      'arm64',
    );
    const zipPath = await downloadElectronZip(downloadOpts);

    await extractElectronZip(zipPath, tempDir);

    const libraries = path.join(
      tempDir,
      'Electron.app/Contents/Frameworks/Electron Framework.framework/Libraries',
    );
    expect(libraries).toBeSymlink();
  });

  it('extractElectronZip resets zero (DOS epoch) timestamps to the extraction time', async () => {
    // Electron's release zips zero out the timestamps of all of their entries,
    // resulting in a 1980-01-01 (DOS epoch) date on every extracted file.
    const zipPath = path.join(__dirname, 'fixtures', 'zero-dated.zip');
    const start = Date.now();

    await extractElectronZip(zipPath, tempDir);

    const extractedPaths = [
      'zero-dated',
      'zero-dated/file.txt',
      'zero-dated/subdir',
      'zero-dated/subdir/nested.txt',
      'zero-dated/link',
    ];
    // Allow for filesystem timestamp granularity.
    const slack = 1000;
    for (const extractedPath of extractedPaths) {
      const stats = await fs.promises.lstat(path.join(tempDir, extractedPath));
      expect(
        stats.mtimeMs,
        `${extractedPath} should not keep the archive mtime`,
      ).toBeGreaterThanOrEqual(start - slack);
    }
  });
});
