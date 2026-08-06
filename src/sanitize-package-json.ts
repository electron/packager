import fs from 'graceful-fs';
import path from 'node:path';

import { debug } from './common.js';
import type { ProcessedOptionsWithSinglePlatformArch } from './types.js';

/**
 * The top-level `package.json` fields that {@link defaultSanitizePackageJson} removes.
 */
const DEFAULT_SANITIZED_FIELDS = [
  'devDependencies',
  'scripts',
  'workspaces',
  'packageManager',
  'resolutions',
  'overrides',
  'pnpm',
  'private',
  'publishConfig',
  'devEngines',
  'jest',
  'eslintConfig',
  'prettier',
  'browserslist',
  'lint-staged',
  'nano-staged',
  'husky',
  'commitlint',
  'mocha',
  'ava',
  'nyc',
  'c8',
  'tap',
  'xo',
  'standard',
];

/**
 * The default implementation of the {@link Options.sanitizePackageJson | sanitizePackageJson}
 * option. Strips development-only fields from the bundled app's `package.json`:
 * `devDependencies`, `scripts`, workspace and package manager settings (`workspaces`,
 * `packageManager`, `resolutions`, `overrides`, `pnpm`), publishing settings (`private`,
 * `publishConfig`, `devEngines`), and common tooling configuration (`jest`, `eslintConfig`,
 * `prettier`, `browserslist`, `lint-staged`, `nano-staged`, `husky`, `commitlint`, `mocha`,
 * `ava`, `nyc`, `c8`, `tap`, `xo`, `standard`).
 *
 * All other fields are kept, notably runtime-relevant ones such as `main`, `name`,
 * `productName`, `version`, `type`, `imports`, `exports`, `dependencies`,
 * `optionalDependencies`, and `peerDependencies`.
 *
 * Custom `sanitizePackageJson` arrays can include this function to extend the default
 * behavior rather than replace it.
 */
export function defaultSanitizePackageJson(
  packageJson: Record<string, unknown>,
): Record<string, unknown> {
  for (const field of DEFAULT_SANITIZED_FIELDS) {
    delete packageJson[field];
  }
  return packageJson;
}

/**
 * Rewrites the `package.json` that was copied into the bundled app directory, using the
 * user-provided {@link Options.sanitizePackageJson | sanitizePackageJson} functions if
 * there are any, or {@link defaultSanitizePackageJson} otherwise. The functions run
 * serially, each receiving the object returned by the previous one.
 *
 * If no `package.json` exists in the bundled app directory, this does nothing; app
 * validation reports the friendlier error for that case.
 */
export async function sanitizeAppPackageJson(
  opts: ProcessedOptionsWithSinglePlatformArch,
  bundledAppDir: string,
): Promise<void> {
  const packageJsonPath = path.join(bundledAppDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  debug('Sanitizing bundled package.json');
  const sanitizers = opts.sanitizePackageJson?.length
    ? opts.sanitizePackageJson
    : [defaultSanitizePackageJson];
  let packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
  for (const sanitize of sanitizers) {
    packageJson = await sanitize(packageJson, opts.electronVersion, opts.platform, opts.arch);
  }
  await fs.promises.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
