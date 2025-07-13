import { spawn } from '@malept/cross-spawn-promise';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import plist from 'plist';
import * as semver from 'semver';

export async function generateAssetCatalogForIcon(inputPath: string) {
  const acToolVersionOutput = await spawn('actool', ['--version']);
  const versionInfo = plist.parse(acToolVersionOutput) as Record<
    string,
    Record<string, string>
  >;
  if (
    !versionInfo ||
    !versionInfo['com.apple.actool.version'] ||
    !versionInfo['com.apple.actool.version']['short-bundle-version']
  ) {
    throw new Error(
      'Incompatible actool, must be on actool from Xcode 26 or higher',
    );
  }

  const acToolVersion =
    versionInfo['com.apple.actool.version']['short-bundle-version'];
  if (!semver.gte(semver.coerce(acToolVersion)!, '26.0.0')) {
    throw new Error(
      `actool is not new enough, must be on actool from Xcode 26 or higher but found ${acToolVersion}`,
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
