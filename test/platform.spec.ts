import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/platform.js';
import type { ProcessedOptionsWithSinglePlatformArch } from '../src/types.js';

describe('App.writeAppVersion', () => {
  let out: string;

  afterEach(async () => {
    await fs.promises.rm(out, { recursive: true, force: true });
  });

  async function createApp(appVersion: string | undefined, packageJSON: Record<string, unknown>) {
    out = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'electron-packager-platform-test-'));
    const opts = {
      name: 'writeAppVersionTest',
      dir: path.join(__dirname, 'fixtures', 'basic'),
      out,
      tmpdir: false,
      platform: 'linux',
      arch: 'x64',
      electronVersion: '27.0.0',
      appVersion,
      ignore: [],
    } as unknown as ProcessedOptionsWithSinglePlatformArch;

    const app = new App(opts, path.join(out, 'template'));
    await fs.promises.mkdir(app.originalResourcesAppDir, { recursive: true });
    const packageJSONPath = path.join(app.originalResourcesAppDir, 'package.json');
    await fs.promises.writeFile(packageJSONPath, JSON.stringify(packageJSON, null, 2));

    return { app, packageJSONPath };
  }

  it('writes the resolved appVersion to the copied package.json', async () => {
    const { app, packageJSONPath } = await createApp('1.2.3', {
      name: 'test-app',
      main: 'main.js',
      version: '0.0.1',
    });

    await app.writeAppVersion();

    const packageJSON = JSON.parse(await fs.promises.readFile(packageJSONPath, 'utf8'));
    expect(packageJSON.version).toEqual('1.2.3');
    expect(packageJSON.name).toEqual('test-app');
    expect(packageJSON.main).toEqual('main.js');
  });

  it('adds a version field if the copied package.json does not have one', async () => {
    const { app, packageJSONPath } = await createApp('4.5.6', {
      name: 'test-app',
      main: 'main.js',
    });

    await app.writeAppVersion();

    const packageJSON = JSON.parse(await fs.promises.readFile(packageJSONPath, 'utf8'));
    expect(packageJSON.version).toEqual('4.5.6');
  });

  it('does not modify the package.json if appVersion is not resolved', async () => {
    const { app, packageJSONPath } = await createApp(undefined, {
      name: 'test-app',
      main: 'main.js',
    });
    const originalContents = await fs.promises.readFile(packageJSONPath, 'utf8');

    await app.writeAppVersion();

    expect(await fs.promises.readFile(packageJSONPath, 'utf8')).toEqual(originalContents);
    expect(JSON.parse(originalContents).version).toBeUndefined();
  });

  it('does not rewrite the package.json if the version already matches', async () => {
    const { app, packageJSONPath } = await createApp('1.2.3', {
      name: 'test-app',
      main: 'main.js',
      version: '1.2.3',
    });
    // Formatting that a rewrite would not preserve
    await fs.promises.writeFile(
      packageJSONPath,
      '{"name":"test-app","main":"main.js","version":"1.2.3"}',
    );

    await app.writeAppVersion();

    expect(await fs.promises.readFile(packageJSONPath, 'utf8')).toEqual(
      '{"name":"test-app","main":"main.js","version":"1.2.3"}',
    );
  });
});
