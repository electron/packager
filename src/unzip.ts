import extractZip from '@electron-internal/extract-zip';

export async function extractElectronZip(zipPath: string, targetDir: string) {
  await extractZip(zipPath, { dir: targetDir });
}
