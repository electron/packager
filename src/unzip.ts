import extractZip from 'extract-zip';

export default async function extractElectronZip(zipPath, targetDir) {
  await extractZip(zipPath, { dir: targetDir });
}
