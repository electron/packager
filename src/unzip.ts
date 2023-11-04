import extractZip from 'extract-zip';

export default async function extractElectronZip(zipPath: string, targetDir: string) {
  await extractZip(zipPath, { dir: targetDir });
}
