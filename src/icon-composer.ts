import { spawn } from '@malept/cross-spawn-promise';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import plist from 'plist';
import semver from 'semver';

// `actool` is not guaranteed to produce a byte-identical `Assets.car` across
// invocations, so when building a universal app we must compile each `.icon`
// exactly once and reuse the output for every architecture. Otherwise the
// per-arch `Assets.car` files differ and the universal stitch fails. The cache
// is keyed by the resolved input path and lives for the duration of the process,
// which spans both arch slices of a universal build.
const assetCatalogCache = new Map<string, Promise<Buffer>>();

export function generateAssetCatalogForIcon(inputPath: string): Promise<Buffer> {
  const cacheKey = path.resolve(inputPath);
  let assetCatalog = assetCatalogCache.get(cacheKey);
  if (!assetCatalog) {
    assetCatalog = compileAssetCatalogForIcon(inputPath);
    // Don't cache failures so a transient `actool` error can be retried.
    assetCatalog.catch(() => assetCatalogCache.delete(cacheKey));
    assetCatalogCache.set(cacheKey, assetCatalog);
  }
  return assetCatalog;
}

async function compileAssetCatalogForIcon(inputPath: string) {
  if (!semver.gte(os.release(), '25.0.0')) {
    throw new Error(`actool .icon support is currently limited to macOS 26 and higher`);
  }

  const acToolVersionOutput = await spawn('actool', ['--version']);
  const versionInfo = plist.parse(acToolVersionOutput) as Record<string, Record<string, string>>;
  if (
    !versionInfo ||
    !versionInfo['com.apple.actool.version'] ||
    !versionInfo['com.apple.actool.version']['short-bundle-version']
  ) {
    throw new Error(
      'Unable to query actool version. Is Xcode 26 or higher installed? See output of the `actool --version` CLI command for more details.',
    );
  }

  const acToolVersion = versionInfo['com.apple.actool.version']['short-bundle-version'];
  if (!semver.gte(semver.coerce(acToolVersion)!, '26.0.0')) {
    throw new Error(
      `Unsupported actool version. Must be on actool 26.0.0 or higher but found ${acToolVersion}. Install XCode 26 or higher to get a supported version of actool.`,
    );
  }

  const tmpDir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'icon-compile-'));
  const iconPath = path.resolve(tmpDir, 'Icon.icon');
  const outputPath = path.resolve(tmpDir, 'out');

  try {
    await fs.cp(inputPath, iconPath, {
      recursive: true,
    });

    await fs.mkdir(outputPath, {
      recursive: true,
    });

    await spawn('actool', [
      iconPath,
      '--compile',
      outputPath,
      '--output-format',
      'human-readable-text',
      '--notices',
      '--warnings',
      '--output-partial-info-plist',
      path.resolve(outputPath, 'assetcatalog_generated_info.plist'),
      '--app-icon',
      'Icon',
      '--include-all-app-icons',
      '--accent-color',
      'AccentColor',
      '--enable-on-demand-resources',
      'NO',
      '--development-region',
      'en',
      '--target-device',
      'mac',
      '--minimum-deployment-target',
      '26.0',
      '--platform',
      'macosx',
    ]);

    return await fs.readFile(path.resolve(outputPath, 'Assets.car'));
  } finally {
    await fs.rm(tmpDir, {
      recursive: true,
      force: true,
    });
  }
}
