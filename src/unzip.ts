import { extract } from '@electron-internal/extract-zip';
import fs from 'graceful-fs';
import path from 'node:path';

/**
 * Recursively sets the access and modification times of everything in a
 * directory tree to the given time.
 */
async function resetTimestamps(dirPath: string, timestamp: Date): Promise<void> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await resetTimestamps(entryPath, timestamp);
    } else if (entry.isSymbolicLink()) {
      await fs.promises.lutimes(entryPath, timestamp, timestamp);
    } else {
      await fs.promises.utimes(entryPath, timestamp, timestamp);
    }
  }
  await fs.promises.utimes(dirPath, timestamp, timestamp);
}

export async function extractElectronZip(zipPath: string, targetDir: string) {
  await extract(zipPath, { dir: targetDir });
  // Electron's release zips zero out the timestamps of all of their entries,
  // so extracting them faithfully results in every file being dated
  // 1980-01-01 (the DOS epoch). Reset the timestamps of the extracted files
  // to the extraction time instead.
  await resetTimestamps(targetDir, new Date());
}
