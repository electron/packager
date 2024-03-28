import * as fs from 'fs-extra';
// eslint-disable-next-line import/no-unresolved
import { load as loadResEdit } from 'resedit/cjs';
import { Win32MetadataOptions } from './types';
import { FileRecord } from '@electron/asar';

export type ExeMetadata = {
  productVersion?: string;
  fileVersion?: string;
  legalCopyright?: string;
  productName?: string;
  iconPath?: string;
  asarIntegrity?: Record<string, Pick<FileRecord['integrity'], 'algorithm' | 'hash'>>;
  win32Metadata?: Win32MetadataOptions;
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

// Ref: https://learn.microsoft.com/en-us/windows/win32/menurc/resource-types
const RT_MANIFEST_TYPE = 24;

export async function resedit(exePath: string, options: ExeMetadata) {
  const resedit = await loadResEdit();

  const exeData = await fs.readFile(exePath);
  const exe = resedit.NtExecutable.from(exeData);
  const res = resedit.NtExecutableResource.from(exe);

  if (options.iconPath) {
    // Icon Info
    const existingIconGroups = resedit.Resource.IconGroupEntry.fromEntries(res.entries);
    if (existingIconGroups.length !== 1) {
      throw new Error('Failed to parse win32 executable resources, failed to locate existing icon group');
    }
    const iconFile = resedit.Data.IconFile.from(await fs.readFile(options.iconPath));
    resedit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      existingIconGroups[0].id,
      existingIconGroups[0].lang,
      iconFile.icons.map((item) => item.data)
    );
  }

  // Manifest
  if (options.win32Metadata?.['application-manifest'] || options.win32Metadata?.['requested-execution-level']) {
    if (options.win32Metadata?.['application-manifest'] && options.win32Metadata?.['requested-execution-level']) {
      throw new Error('application-manifest and requested-execution-level are mutually exclusive, only provide one');
    }

    const manifests = res.entries.filter(e => e.type === RT_MANIFEST_TYPE);
    if (manifests.length !== 1) {
      throw new Error('Failed to parse win32 executable resources, failed to locate existing manifest');
    }
    const manifestEntry = manifests[0];
    if (options.win32Metadata?.['application-manifest']) {
      manifestEntry.bin = (await fs.readFile(options.win32Metadata?.['application-manifest'])).buffer;
    } else if (options.win32Metadata?.['requested-execution-level']) {
      // This implementation matches what rcedit used to do, in theory we can be Smarter
      // and use an actual XML parser, but for now let's match the old impl
      const currentManifestContent = Buffer.from(manifestEntry.bin).toString('utf-8');
      const newContent = currentManifestContent.replace(
        /(<requestedExecutionLevel level=")asInvoker(" uiAccess="false"\/>)/g,
        `$1${options.win32Metadata?.['requested-execution-level']}$2`
      );
      manifestEntry.bin = Buffer.from(newContent, 'utf-8');
    }
  }

  // Version Info
  const versionInfo = resedit.Resource.VersionInfo.fromEntries(res.entries);
  if (versionInfo.length !== 1) {
    throw new Error('Failed to parse win32 executable resources, failed to locate existing version info');
  }
  if (options.fileVersion) versionInfo[0].setFileVersion(...parseVersionString(options.fileVersion));
  if (options.productVersion) versionInfo[0].setProductVersion(...parseVersionString(options.productVersion));
  const languageInfo = versionInfo[0].getAllLanguagesForStringValues();
  if (languageInfo.length !== 1) {
    throw new Error('Failed to parse win32 executable resources, failed to locate existing language info');
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

  // Asar Integrity
  if (options.asarIntegrity) {
    const integrityList = Object.keys(options.asarIntegrity).map((file) => ({
      file,
      alg: options.asarIntegrity![file].algorithm,
      value: options.asarIntegrity![file].hash,
    }));
    res.entries.push({
      type: 'INTEGRITY',
      id: 'ELECTRONASAR',
      bin: Buffer.from(JSON.stringify(integrityList), 'utf-8'),
      lang: languageInfo[0].lang,
      codepage: languageInfo[0].codepage,
    });
  }

  res.outputResource(exe);

  await fs.writeFile(exePath, Buffer.from(exe.generate()));
}
