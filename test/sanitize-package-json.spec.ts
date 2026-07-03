import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from '../src/platform.js';
import {
  defaultSanitizePackageJson,
  sanitizeAppPackageJson,
} from '../src/sanitize-package-json.js';
import type { ProcessedOptionsWithSinglePlatformArch } from '../src/types.js';

const STRIPPED_FIELDS = {
  devDependencies: { typescript: '^5.0.0' },
  scripts: { start: 'electron .' },
  workspaces: ['packages/*'],
  packageManager: 'yarn@4.10.2',
  resolutions: { lodash: '4.17.21' },
  overrides: { lodash: '4.17.21' },
  pnpm: { overrides: {} },
  private: true,
  publishConfig: { provenance: true },
  devEngines: { runtime: { name: 'node' } },
  jest: { testEnvironment: 'node' },
  eslintConfig: { root: true },
  prettier: { semi: false },
  browserslist: ['last 2 versions'],
  'lint-staged': { '*.js': 'eslint' },
  'nano-staged': { '*.js': 'eslint' },
  husky: { hooks: {} },
  commitlint: { extends: [] },
  mocha: { spec: 'test' },
  ava: { files: [] },
  nyc: { all: true },
  c8: { all: true },
  tap: { coverage: true },
  xo: { semicolon: false },
  standard: { env: [] },
};

const KEPT_FIELDS = {
  main: 'main.js',
  name: 'sanitize-test',
  productName: 'Sanitize Test',
  version: '1.2.3',
  type: 'module',
  desktopName: 'sanitize-test.desktop',
  imports: { '#internal': './src/internal.js' },
  exports: { '.': './main.js' },
  dependencies: { debug: '^4.4.1' },
  optionalDependencies: { fsevents: '^2.3.3' },
  peerDependencies: { electron: '>=30.0.0' },
};

function fullPackageJson(): Record<string, unknown> {
  return structuredClone({ ...KEPT_FIELDS, ...STRIPPED_FIELDS });
}

describe('defaultSanitizePackageJson', () => {
  it('strips development-only fields', () => {
    const sanitized = defaultSanitizePackageJson(fullPackageJson());
    for (const field of Object.keys(STRIPPED_FIELDS)) {
      expect(sanitized, `expected ${field} to be stripped`).not.toHaveProperty([field]);
    }
  });

  it('keeps runtime-relevant fields', () => {
    const sanitized = defaultSanitizePackageJson(fullPackageJson());
    expect(sanitized).toEqual(KEPT_FIELDS);
  });
});

describe('sanitizeAppPackageJson', () => {
  let bundledAppDir: string;

  beforeEach(async () => {
    bundledAppDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'packager-sanitize-'));
    await fs.promises.writeFile(
      path.join(bundledAppDir, 'package.json'),
      JSON.stringify(fullPackageJson()),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(bundledAppDir, { recursive: true, force: true });
  });

  async function readBundledPackageJson(): Promise<{
    raw: string;
    parsed: Record<string, unknown>;
  }> {
    const raw = await fs.promises.readFile(path.join(bundledAppDir, 'package.json'), 'utf8');
    return { raw, parsed: JSON.parse(raw) };
  }

  it('writes the default-sanitized package.json to disk with 2-space indentation', async () => {
    await sanitizeAppPackageJson({} as ProcessedOptionsWithSinglePlatformArch, bundledAppDir);

    const { raw, parsed } = await readBundledPackageJson();
    expect(parsed).toEqual(KEPT_FIELDS);
    expect(raw).toBe(`${JSON.stringify(KEPT_FIELDS, null, 2)}\n`);
  });

  it('applies the default sanitizer when an empty array is provided', async () => {
    const opts = {
      sanitizePackageJson: [],
    } as unknown as ProcessedOptionsWithSinglePlatformArch;
    await sanitizeAppPackageJson(opts, bundledAppDir);

    const { parsed } = await readBundledPackageJson();
    expect(parsed).toEqual(KEPT_FIELDS);
  });

  it('replaces the default sanitizer with user-provided functions', async () => {
    const opts = {
      sanitizePackageJson: [
        async (packageJson: Record<string, unknown>) => {
          delete packageJson.scripts;
          packageJson.userField = 'set by user';
          return packageJson;
        },
      ],
    } as unknown as ProcessedOptionsWithSinglePlatformArch;
    await sanitizeAppPackageJson(opts, bundledAppDir);

    const { parsed } = await readBundledPackageJson();
    expect(parsed).not.toHaveProperty('scripts');
    expect(parsed).toHaveProperty('userField', 'set by user');
    // the default sanitizer must NOT also run
    expect(parsed).toHaveProperty('devDependencies');
    expect(parsed).toHaveProperty(['lint-staged']);
  });

  it('writes the object returned by the user-provided sanitizer', async () => {
    const opts = {
      sanitizePackageJson: [() => ({ name: 'replaced', main: 'main.js' })],
    } as unknown as ProcessedOptionsWithSinglePlatformArch;
    await sanitizeAppPackageJson(opts, bundledAppDir);

    const { parsed } = await readBundledPackageJson();
    expect(parsed).toEqual({ name: 'replaced', main: 'main.js' });
  });

  it('runs multiple sanitizers serially, each receiving the previous result', async () => {
    const callOrder: string[] = [];
    const opts = {
      electronVersion: '30.0.0',
      platform: 'darwin',
      arch: 'arm64',
      sanitizePackageJson: [
        (
          packageJson: Record<string, unknown>,
          electronVersion: string,
          platform: string,
          arch: string,
        ) => {
          callOrder.push(`first:${electronVersion}:${platform}:${arch}`);
          return { fromFirst: Object.keys(packageJson).length };
        },
        async (
          packageJson: Record<string, unknown>,
          electronVersion: string,
          platform: string,
          arch: string,
        ) => {
          callOrder.push(`second:${electronVersion}:${platform}:${arch}`);
          return { ...packageJson, fromSecond: true };
        },
      ],
    } as unknown as ProcessedOptionsWithSinglePlatformArch;
    await sanitizeAppPackageJson(opts, bundledAppDir);

    expect(callOrder).toEqual(['first:30.0.0:darwin:arm64', 'second:30.0.0:darwin:arm64']);
    const { parsed } = await readBundledPackageJson();
    expect(parsed).toEqual({
      fromFirst: Object.keys(fullPackageJson()).length,
      fromSecond: true,
    });
  });

  it('does nothing when no package.json exists', async () => {
    await fs.promises.rm(path.join(bundledAppDir, 'package.json'));
    await expect(
      sanitizeAppPackageJson({} as ProcessedOptionsWithSinglePlatformArch, bundledAppDir),
    ).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(bundledAppDir, 'package.json'))).toBe(false);
  });
});

describe('copyTemplate', () => {
  let appDir: string;
  let tmpBase: string;

  beforeEach(async () => {
    appDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'packager-sanitize-app-'));
    tmpBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'packager-sanitize-tmp-'));
    await fs.promises.writeFile(
      path.join(appDir, 'package.json'),
      JSON.stringify(fullPackageJson()),
    );
    await fs.promises.writeFile(path.join(appDir, 'main.js'), '');
  });

  afterEach(async () => {
    for (const dir of [appDir, tmpBase]) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });

  function baseOpts(): ProcessedOptionsWithSinglePlatformArch {
    return {
      dir: appDir,
      name: 'sanitizeTest',
      appVersion: '1.2.3',
      electronVersion: '30.0.0',
      platform: 'linux',
      arch: 'x64',
      ignore: [],
      tmpdir: tmpBase,
      quiet: true,
    };
  }

  it('sanitizes after the afterCopy hooks and before the afterPrune hooks', async () => {
    const devDependenciesSeen: Record<string, boolean> = {};
    const readDevDependencies = (hookName: string) => {
      return async ({ buildPath }: { buildPath: string }) => {
        const packageJson = JSON.parse(
          await fs.promises.readFile(path.join(buildPath, 'package.json'), 'utf8'),
        );
        devDependenciesSeen[hookName] = 'devDependencies' in packageJson;
      };
    };
    const opts = {
      ...baseOpts(),
      prune: true,
      afterCopy: [readDevDependencies('afterCopy')],
      afterPrune: [readDevDependencies('afterPrune')],
    };

    const app = new App(opts, path.join(tmpBase, 'unused-template'));
    await app.copyTemplate();

    expect(devDependenciesSeen).toEqual({ afterCopy: true, afterPrune: false });
    const bundledPackageJson = JSON.parse(
      await fs.promises.readFile(path.join(app.originalResourcesAppDir, 'package.json'), 'utf8'),
    );
    expect(bundledPackageJson).toEqual(KEPT_FIELDS);
  });

  it('is incompatible with prebuiltAsar', async () => {
    const opts = {
      ...baseOpts(),
      prebuiltAsar: path.join(appDir, 'app.asar'),
      sanitizePackageJson: [(packageJson: Record<string, unknown>) => packageJson],
    };

    const app = new App(opts, path.join(tmpBase, 'unused-template'));
    await expect(app.copyPrebuiltAsar()).rejects.toThrow(
      'sanitizePackageJson is incompatible with prebuiltAsar',
    );
  });
});
