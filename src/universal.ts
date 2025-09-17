import { makeUniversalApp } from '@electron/universal';
import { generateFinalPath, info } from './common.js';
import fs from 'graceful-fs';
import { promisifiedGracefulFs } from './util.js';
import path from 'node:path';
import { App } from './mac.js';
import { ComboOptions, DownloadOptions, OfficialArch } from './types.js';
import { Packager } from './packager.js';

export async function packageUniversalMac(
  packageForPlatformAndArchWithOpts: Packager['packageForPlatformAndArchWithOpts'],
  buildDir: string,
  comboOpts: ComboOptions,
  downloadOpts: DownloadOptions,
  tempBase: string,
) {
  // In order to generate a universal macOS build we actually need to build the x64 and the arm64 app
  // and then glue them together
  info(
    `Packaging app for platform ${comboOpts.platform} universal using electron v${comboOpts.electronVersion} - Building x64 and arm64 slices now`,
    comboOpts.quiet,
  );
  await fs.promises.mkdir(tempBase, { recursive: true });
  const tempDir = await fs.promises.mkdtemp(
    path.resolve(tempBase, 'electron-packager-universal-'),
  );

  const app = new App(comboOpts, buildDir);
  const universalStagingPath = app.stagingPath;
  const finalUniversalPath = generateFinalPath(app.opts);

  if (fs.existsSync(finalUniversalPath)) {
    if (comboOpts.overwrite) {
      await fs.promises.rm(finalUniversalPath, {
        recursive: true,
        force: true,
      });
    } else {
      info(
        `Skipping ${comboOpts.platform} ${comboOpts.arch} (output dir already exists, use --overwrite to force)`,
        comboOpts.quiet,
      );
      return true;
    }
  }

  const tempPackages = {} as Record<OfficialArch, string>;

  await Promise.all(
    (['x64', 'arm64'] as OfficialArch[]).map(async (tempArch) => {
      const tempOpts = {
        ...comboOpts,
        arch: tempArch,
        out: tempDir,
      };
      const tempDownloadOpts = {
        ...downloadOpts,
        arch: tempArch,
      };
      // Do not sign or notarize the individual slices, we sign and notarize the merged app later
      delete tempOpts.osxSign;
      delete tempOpts.osxNotarize;

      // @TODO(erikian): I don't like this type cast, the return type for `packageForPlatformAndArchWithOpts` is probably wrong
      tempPackages[tempArch] = (await packageForPlatformAndArchWithOpts(
        tempOpts,
        tempDownloadOpts,
      )) as string;
    }),
  );

  const x64AppPath = tempPackages.x64;
  const arm64AppPath = tempPackages.arm64;

  info(
    `Stitching universal app for platform ${comboOpts.platform}`,
    comboOpts.quiet,
  );

  const generatedFiles = await promisifiedGracefulFs.readdir(x64AppPath);
  const appName = generatedFiles.filter(
    (file) => path.extname(file) === '.app',
  )[0];

  await makeUniversalApp({
    ...comboOpts.osxUniversal,
    x64AppPath: path.resolve(x64AppPath, appName),
    arm64AppPath: path.resolve(arm64AppPath, appName),
    outAppPath: path.resolve(universalStagingPath, appName),
    force: false,
  });

  await app.signAppIfSpecified();
  await app.notarizeAppIfSpecified();
  await app.move();

  for (const generatedFile of generatedFiles) {
    if (path.extname(generatedFile) === '.app') {
      continue;
    }

    await fs.promises.cp(
      path.resolve(x64AppPath, generatedFile),
      path.resolve(finalUniversalPath, generatedFile),
    );
  }

  await fs.promises.rm(tempDir, { recursive: true, force: true });

  return finalUniversalPath;
}
