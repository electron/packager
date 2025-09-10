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
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-'),
    );

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
});
