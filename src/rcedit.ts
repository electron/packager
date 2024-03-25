import * as fs from 'fs-extra';
// eslint-disable-next-line import/no-unresolved
import { load as loadResEdit } from 'resedit/cjs';
import { Win32MetadataOptions } from './types';

export type ExeMetadata = {
  productVersion?: string;
  fileVersion?: string;
  legalCopyright?: string;
  productName?: string;
  iconPath?: string;
  win32Metadata?: Win32MetadataOptions;
  // TODO: Support manifest and requested-execution-level
}

type ParsedVersionNumerics = [number, number, number, number];

/**
 * Parse a version string in the format a.b.c.d with each component being optional
 * but if present must be an integer. Matches the impl in rcedit for compat
 */
function parseVersionString(str: string): ParsedVersionNumerics {
  const parts = str.split('.');
  if (parts.length === 0 || parts.length > 4) {
    throw new Error(`Incorrectly formatted version string: "${str}". Should have at least one and at most four components`);
  }
  return parts.map((part) => {
    const parsed = parseInt(part, 10);
    if (isNaN(parsed)) {
      throw new Error(`Incorrectly formatted version string: "${str}". Component "${part}" could not be parsed as an integer`);
    }
    return parsed;
  }) as ParsedVersionNumerics;
}

export async function rcedit(exePath: string, options: ExeMetadata) {
  const resedit = await loadResEdit();

  const exeData = await fs.readFile(exePath);
  const exe = resedit.NtExecutable.from(exeData);
  const res = resedit.NtExecutableResource.from(exe);

  if (options.iconPath) {
    // Icon Info
    const existingIconGroups = resedit.Resource.IconGroupEntry.fromEntries(res.entries);
    if (existingIconGroups.length !== 1) {
      throw new Error('wat?');
    }
    const iconFile = resedit.Data.IconFile.from(await fs.readFile(options.iconPath));
    resedit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      existingIconGroups[0].id,
      existingIconGroups[0].lang,
      iconFile.icons.map((item) => item.data)
    );
  }

  // Version Info
  const versionInfo = resedit.Resource.VersionInfo.fromEntries(res.entries);
  if (versionInfo.length !== 1) {
    throw new Error('wat?');
  }
  if (options.fileVersion) versionInfo[0].setFileVersion(...parseVersionString(options.fileVersion));
  if (options.productVersion) versionInfo[0].setProductVersion(...parseVersionString(options.productVersion));
  const languageInfo = versionInfo[0].getAllLanguagesForStringValues();
  if (languageInfo.length !== 1) {
    throw new Error('wat?');
  }
  // Empty strings retain original value
  const newStrings: Record<string, string> = {
    CompanyName: options.win32Metadata?.CompanyName || '',
    FileDescription: options.win32Metadata?.FileDescription || '',
    FileVersion: options.fileVersion || '',
    InternalName: options.win32Metadata?.InternalName || '',
    LegalCopyright: options.legalCopyright || '',
    OriginalFilename: options.win32Metadata?.OriginalFilename || '',
    ProductName: options.productName || '',
    ProductVersion: options.productVersion || '',
  };
  for (const key of Object.keys(newStrings)) {
    if (!newStrings[key]) delete newStrings[key];
  }
  versionInfo[0].setStringValues(languageInfo[0], newStrings);

  // Output version info
  versionInfo[0].outputToResourceEntries(res.entries);

  res.outputResource(exe);

  await fs.writeFile(exePath, Buffer.from(exe.generate()));
}
