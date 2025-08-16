'use strict';

const config = require('./config.json');
const { packager } = require('../dist');
const path = require('path');
const test = require('ava');
const util = require('./_util');
const { load: loadResedit } = require('resedit/cjs');
const fs = require('fs-extra');

const win32Opts = {
  name: 'basicTest',
  dir: util.fixtureSubdir('basic'),
  electronVersion: config.version,
  arch: 'x64',
  platform: 'win32',
};



function win32Test(extraOpts, executableBasename, executableMessage) {
  return util.packagerTest(async (t, opts) => {
    Object.assign(opts, win32Opts, extraOpts);

    const paths = await packager(opts);
    t.is(1, paths.length, '1 bundle created');
    const exePath = path.join(paths[0], `${executableBasename}.exe`);
    await util.assertPathExists(t, exePath, executableMessage);
    return exePath;
  });
}

test.serial(
  'win32: executable name is based on sanitized app name',
  win32Test(
    { name: '@username/package-name' },
    '@username-package-name',
    'The sanitized EXE filename should exist',
  ),
);

test.serial(
  'win32: executable name uses executableName when available',
  win32Test(
    { name: 'PackageName', executableName: 'my-package' },
    'my-package',
    'the executableName-based filename should exist',
  ),
);

test.serial(
  'win32: set icon',
  win32Test(
    {
      executableName: 'iconTest',
      arch: 'ia32',
      icon: path.join(__dirname, 'fixtures', 'monochrome'),
    },
    'iconTest',
    'the Electron executable should exist',
  ),
);

test.serial('win32: version info is set correctly in final exe', async (t) => {
  const exePath = await win32Test(
    {
      executableName: 'versionInfoTest',
      arch: 'x64',
      appVersion: '1.2.3',
      buildVersion: '4.5.6',
    },
    'versionInfoTest',
    'the Electron executable should exist',
  )(t);

  const resedit = await loadResedit();
  const exe = resedit.NtExecutable.from(await fs.readFile(exePath));
  const res = resedit.NtExecutableResource.from(exe);

  const versionInfo = resedit.Resource.VersionInfo.fromEntries(res.entries);
  t.is(versionInfo.length, 1, 'should only have one version info resource');
  const version = versionInfo[0];
  const langs = version.getAllLanguagesForStringValues();
  t.is(langs.length, 1, 'should only have one lang');
  t.is(
    version.getStringValues(langs[0]).FileVersion,
    '4.5.6',
    'file version should match build version',
  );
  t.is(
    version.getStringValues(langs[0]).ProductVersion,
    '1.2.3',
    'product version should match app version',
  );
});

test.serial(
  'win32: requested execution level is set correctly in final exe',
  async (t) => {
    const exePath = await win32Test(
      {
        executableName: 'versionInfoTest',
        arch: 'x64',
        win32metadata: { 'requested-execution-level': 'requireAdministrator' },
      },
      'versionInfoTest',
      'the Electron executable should exist',
    )(t);

    const resedit = await loadResedit();
    const exe = resedit.NtExecutable.from(await fs.readFile(exePath));
    const res = resedit.NtExecutableResource.from(exe);

    const manifest = res.entries.find((e) => e.type === 24);
    const manifestString = Buffer.from(manifest.bin).toString('utf-8');
    t.is(
      manifestString.includes('requireAdministrator'),
      true,
      'should have the new level in the manifest',
    );
  },
);

