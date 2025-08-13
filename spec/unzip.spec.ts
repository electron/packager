import { createDownloadOpts, downloadElectronZip } from '../src/download';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { extractElectronZip } from '../src/unzip';

describe('extractElectronZip', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'electron-packager-test-'),
    );

    return async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    };
  });

  it('extractElectronZip preserves symbolic links', async (t) => {
    const downloadOpts = createDownloadOpts(
      {
        electronVersion: '27.0.0',
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
    expect(fs.existsSync(libraries)).toBe(true);
    expect(fs.lstatSync(libraries).isSymbolicLink()).toBe(true);
  });
});
