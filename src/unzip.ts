import { extract } from '@electron-internal/extract-zip';

export async function extractElectronZip(zipPath: string, targetDir: string) {
  await extract(zipPath, { dir: targetDir });
}
