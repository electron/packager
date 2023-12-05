'use strict'

const config = require('./config.json')
const { packager } = require('../dist')
const path = require('path')
const test = require('ava')
const util = require('./_util')
const { updateWineMissingException, WindowsApp } = require('../dist/win32')
const { WrapperError } = require('cross-spawn-windows-exe')

const win32Opts = {
  name: 'basicTest',
  dir: util.fixtureSubdir('basic'),
  electronVersion: config.version,
  arch: 'x64',
  platform: 'win32'
}

function generateRceditOptionsSansIcon (opts) {
  return new WindowsApp(opts).generateRceditOptionsSansIcon()
}

function generateVersionStringTest (metadataProperties, extraOpts, expectedValues, assertionMsgs) {
  return t => {
    const opts = { ...win32Opts, ...extraOpts }
    const rcOpts = generateRceditOptionsSansIcon(opts)

    metadataProperties = [].concat(metadataProperties)
    expectedValues = [].concat(expectedValues)
    assertionMsgs = [].concat(assertionMsgs)
    metadataProperties.forEach((property, i) => {
      const value = expectedValues[i]
      const msg = assertionMsgs[i]
      if (property === 'version-string') {
        for (const subkey in value) {
          t.is(rcOpts[property][subkey], value[subkey], `${msg} (${subkey})`)
        }
      } else {
        t.is(rcOpts[property], value, msg)
      }
    })
  }
}

function setFileVersionTest (buildVersion) {
  const appVersion = '4.99.101.0'
  const opts = {
    appVersion: appVersion,
    buildVersion: buildVersion
  }

  return generateVersionStringTest(
    ['product-version', 'file-version'],
    opts,
    [appVersion, buildVersion],
    ['Product version should match app version',
      'File version should match build version']
  )
}

function setProductVersionTest (appVersion) {
  return generateVersionStringTest(
    ['product-version', 'file-version'],
    { appVersion: appVersion },
    [appVersion, appVersion],
    ['Product version should match app version',
      'File version should match app version']
  )
}

function setCopyrightTest (appCopyright) {
  const opts = {
    appCopyright: appCopyright
  }

  return generateVersionStringTest('version-string', opts, { LegalCopyright: appCopyright }, 'Legal copyright should match app copyright')
}

function setCopyrightAndCompanyNameTest (appCopyright, companyName) {
  const opts = {
    appCopyright: appCopyright,
    win32metadata: {
      CompanyName: companyName
    }
  }

  return generateVersionStringTest(
    'version-string',
    opts,
    { LegalCopyright: appCopyright, CompanyName: companyName },
    'Legal copyright should match app copyright and Company name should match win32metadata value'
  )
}

function setRequestedExecutionLevelTest (requestedExecutionLevel) {
  const opts = {
    win32metadata: {
      'requested-execution-level': requestedExecutionLevel
    }
  }

  return generateVersionStringTest(
    'requested-execution-level',
    opts,
    requestedExecutionLevel,
    'requested-execution-level in win32metadata should match rcOpts value'
  )
}

function setApplicationManifestTest (applicationManifest) {
  const opts = {
    win32metadata: {
      'application-manifest': applicationManifest
    }
  }

  return generateVersionStringTest(
    'application-manifest',
    opts,
    applicationManifest,
    'application-manifest in win32metadata should match rcOpts value'
  )
}

function setCompanyNameTest (companyName) {
  const opts = {
    win32metadata: {
      CompanyName: companyName
    }
  }

  return generateVersionStringTest('version-string',
                                   opts,
                                   { CompanyName: companyName },
                                   'Company name should match win32metadata value')
}

test('better error message when wine is not found', t => {
  const err = new WrapperError('wine-nonexistent')

  t.notRegex(err.message, /win32metadata/)
  const augmentedError = updateWineMissingException(err)
  t.regex(augmentedError.message, /win32metadata/)
})

test('error message unchanged when error not about wine missing', t => {
  const notWrapperError = Error('Not a wrapper error')

  const returnedError = updateWineMissingException(notWrapperError)
  t.is(returnedError.message, 'Not a wrapper error')
})

// Wine-using platforms only; macOS exhibits a strange behavior in CI,
// so we're disabling it there as well.
if (process.platform === 'linux') {
  test.serial('win32 integration: catches a missing wine executable', util.packagerTest(async (t, opts) => {
    process.env.WINE_BINARY = 'wine-nonexistent'
    try {
      await t.throwsAsync(() => packager({
        ...opts,
        ...win32Opts
      }), {
        instanceOf: WrapperError,
        message: /wine-nonexistent.*win32metadata/ms
      })
    } finally {
      delete process.env.WINE_BINARY
    }
  }))
}

test('win32metadata defaults', t => {
  const opts = { name: 'Win32 App' }
  const rcOpts = generateRceditOptionsSansIcon(opts)

  t.is(rcOpts['version-string'].FileDescription, opts.name, 'default FileDescription')
  t.is(rcOpts['version-string'].InternalName, opts.name, 'default InternalName')
  t.is(rcOpts['version-string'].OriginalFilename, 'Win32 App.exe', 'default OriginalFilename')
  t.is(rcOpts['version-string'].ProductName, opts.name, 'default ProductName')
})

function win32Test (extraOpts, executableBasename, executableMessage) {
  return util.packagerTest(async (t, opts) => {
    Object.assign(opts, win32Opts, extraOpts)

    const paths = await packager(opts)
    t.is(1, paths.length, '1 bundle created')
    await util.assertPathExists(t, path.join(paths[0], `${executableBasename}.exe`), executableMessage)
  })
}

if (!(process.env.CI && process.platform === 'darwin')) {
  test.serial('win32: executable name is based on sanitized app name', win32Test(
    { name: '@username/package-name' },
    '@username-package-name',
    'The sanitized EXE filename should exist'
  ))

  test.serial('win32: executable name uses executableName when available', win32Test(
    { name: 'PackageName', executableName: 'my-package' },
    'my-package',
    'the executableName-based filename should exist'
  ))

  test.serial('win32: set icon', win32Test(
    { executableName: 'iconTest', arch: 'ia32', icon: path.join(__dirname, 'fixtures', 'monochrome') },
    'iconTest',
    'the Electron executable should exist'
  ))

  test('win32: build version sets FileVersion', setFileVersionTest('2.3.4.5'))
  test('win32: app version sets ProductVersion', setProductVersionTest('5.4.3.2'))
  test('win32: app copyright sets LegalCopyright', setCopyrightTest('Copyright Bar'))
  test('win32: set LegalCopyright and CompanyName', setCopyrightAndCompanyNameTest('Copyright Bar', 'MyCompany LLC'))
  test('win32: set CompanyName', setCompanyNameTest('MyCompany LLC'))
  test('win32: set requested-execution-level', setRequestedExecutionLevelTest('asInvoker'))
  test('win32: set application-manifest', setApplicationManifestTest('/path/to/manifest.xml'))
}
