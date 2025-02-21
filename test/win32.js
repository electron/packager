'use strict';

const config = require('./config.json');
const { packager } = require('../dist');
const path = require('path');
const test = require('ava');
const _ = require('lodash');
const util = require('./_util');
const { WindowsApp } = require('../dist/win32');
const { load: loadResedit } = require('resedit/cjs');
const fs = require('fs-extra');

const win32Opts = {
  name: 'basicTest',
  dir: util.fixtureSubdir('basic'),
  electronVersion: config.version,
  arch: 'x64',
  platform: 'win32',
};

function generateReseditOptionsSansIcon(opts) {
  return new WindowsApp(opts).generateReseditOptionsSansIcon();
}

function generateVersionStringTest(
  metadataProperties,
  extraOpts,
  expectedValues,
  assertionMsgs,
) {
  return (t) => {
    const opts = { ...win32Opts, ...extraOpts };
    const rcOpts = generateReseditOptionsSansIcon(opts);

    metadataProperties = [].concat(metadataProperties);
    expectedValues = [].concat(expectedValues);
    assertionMsgs = [].concat(assertionMsgs);
    metadataProperties.forEach((property, i) => {
      const value = expectedValues[i];
      const msg = assertionMsgs[i];
      t.is(_.get(rcOpts, property), value, msg);
    });
  };
}

function setFileVersionTest(buildVersion) {
  const appVersion = '4.99.101.0';
  const opts = {
    appVersion: appVersion,
    buildVersion: buildVersion,
  };

  return generateVersionStringTest(
    ['productVersion', 'fileVersion'],
    opts,
    [appVersion, buildVersion],
    [
      'Product version should match app version',
      'File version should match build version',
    ],
  );
}

function setProductVersionTest(appVersion) {
  return generateVersionStringTest(
    ['productVersion', 'fileVersion'],
    { appVersion: appVersion },
    [appVersion, appVersion],
    [
      'Product version should match app version',
      'File version should match app version',
    ],
  );
}

function setCopyrightTest(appCopyright) {
  const opts = {
    appCopyright: appCopyright,
  };

  return generateVersionStringTest(
    ['legalCopyright'],
    opts,
    [appCopyright],
    'Legal copyright should match app copyright',
  );
}

function setCopyrightAndCompanyNameTest(appCopyright, companyName) {
  const opts = {
    appCopyright: appCopyright,
    win32metadata: {
      CompanyName: companyName,
    },
  };

  return generateVersionStringTest(
    ['legalCopyright', 'win32Metadata.CompanyName'],
    opts,
    [appCopyright, companyName],
    'Legal copyright should match app copyright and Company name should match win32metadata value',
  );
}

function setRequestedExecutionLevelTest(requestedExecutionLevel) {
  const opts = {
    win32metadata: {
      'requested-execution-level': requestedExecutionLevel,
    },
  };

  return generateVersionStringTest(
    ['win32Metadata.requested-execution-level'],
    opts,
    [requestedExecutionLevel],
    'requested-execution-level in win32metadata should match rcOpts value',
  );
}

function setApplicationManifestTest(applicationManifest) {
  const opts = {
    win32metadata: {
      'application-manifest': applicationManifest,
    },
  };

  return generateVersionStringTest(
    ['win32Metadata.application-manifest'],
    opts,
    [applicationManifest],
    'application-manifest in win32metadata should match rcOpts value',
  );
}

function setCompanyNameTest(companyName) {
  const opts = {
    win32metadata: {
      CompanyName: companyName,
    },
  };

  return generateVersionStringTest(
    ['win32Metadata.CompanyName'],
    opts,
    [companyName],
    'Company name should match win32metadata value',
  );
}

test('win32metadata defaults', (t) => {
  const opts = { name: 'Win32 App' };
  const rcOpts = generateReseditOptionsSansIcon(opts);

  t.is(
    rcOpts.win32Metadata.FileDescription,
    opts.name,
    'default FileDescription',
  );
  t.is(rcOpts.win32Metadata.InternalName, opts.name, 'default InternalName');
  t.is(
    rcOpts.win32Metadata.OriginalFilename,
    'Win32 App.exe',
    'default OriginalFilename',
  );
  t.is(rcOpts.productName, opts.name, 'default ProductName');
});

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

test('win32: build version sets FileVersion', setFileVersionTest('2.3.4.5'));
test(
  'win32: app version sets ProductVersion',
  setProductVersionTest('5.4.3.2'),
);
test(
  'win32: app copyright sets LegalCopyright',
  setCopyrightTest('Copyright Bar'),
);
test(
  'win32: set LegalCopyright and CompanyName',
  setCopyrightAndCompanyNameTest('Copyright Bar', 'MyCompany LLC'),
);
test('win32: set CompanyName', setCompanyNameTest('MyCompany LLC'));
test(
  'win32: set requested-execution-level',
  setRequestedExecutionLevelTest('asInvoker'),
);
test(
  'win32: set application-manifest',
  setApplicationManifestTest('/path/to/manifest.xml'),
);
