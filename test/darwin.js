'use strict'

const config = require('./config.json')
const { exec } = require('mz/child_process')
const fs = require('fs-extra')
const mac = require('../mac')
const packager = require('..')
const path = require('path')
const plist = require('plist')
const test = require('ava')
const util = require('./_util')

const darwinOpts = {
  name: 'darwinTest',
  dir: util.fixtureSubdir('basic'),
  electronVersion: config.version,
  arch: 'x64',
  platform: 'darwin'
}

const el0374Opts = {
  ...darwinOpts,
  name: 'el0374Test',
  dir: util.fixtureSubdir('el-0374'),
  electronVersion: '0.37.4'
}

function testWrapper (testName, extraOpts, testFunction, ...extraArgs) {
  util.packagerTest(testName, (t, baseOpts) => {
    const opts = { ...baseOpts, ...extraOpts }

    return testFunction(t, opts, ...extraArgs)
  })
}

function darwinTest (testName, testFunction, ...extraArgs) {
  return testWrapper(testName, darwinOpts, testFunction, ...extraArgs)
}

function electron0374Test (testName, testFunction, ...extraArgs) {
  return testWrapper(testName, el0374Opts, testFunction, ...extraArgs)
}

function getFrameworksPath (prefix, appName) {
  return path.join(prefix, `${appName}.app`, 'Contents', 'Frameworks')
}

function getHelperAppPath (prefix, appName, helperSuffix) {
  return path.join(getFrameworksPath(prefix, appName), `${appName} ${helperSuffix}.app`)
}

function getHelperExecutablePath (prefix, appName, helperSuffix) {
  return path.join(getHelperAppPath(prefix, appName, helperSuffix), 'Contents', 'MacOS', `${appName} ${helperSuffix}`)
}

async function parseInfoPlist (t, opts, basePath) {
  return util.parsePlist(t, path.join(basePath, `${opts.name}.app`))
}

async function packageAndParseInfoPlist (t, opts) {
  const finalPath = (await packager(opts))[0]
  return parseInfoPlist(t, opts, finalPath)
}

function assertPlistStringValue (t, obj, property, value, message) {
  t.is(obj[property], value, message)
  t.is(typeof obj[property], 'string', `${property} should be a string`)
}

function assertCFBundleIdentifierValue (t, obj, value, message) {
  assertPlistStringValue(t, obj, 'CFBundleIdentifier', value, message)
  t.is(/^[a-zA-Z0-9-.]*$/.test(obj.CFBundleIdentifier), true, 'CFBundleIdentifier should allow only alphanumeric (A-Z,a-z,0-9), hyphen (-), and period (.)')
}

async function assertHelper (t, prefix, appName, helperSuffix) {
  await util.assertDirectory(t, getHelperAppPath(prefix, appName, helperSuffix), `The ${helperSuffix}.app should reflect sanitized opts.name`)
  await util.assertFile(t, getHelperExecutablePath(prefix, appName, helperSuffix), `The ${helperSuffix}.app executable should reflect sanitized opts.name`)
}

async function helperAppPathsTest (t, baseOpts, extraOpts, expectedName) {
  const opts = { ...baseOpts, ...extraOpts }

  if (!expectedName) {
    expectedName = opts.name
  }

  const finalPath = (await packager(opts))[0]
  const helpers = [
    'Helper',
    'Helper EH',
    'Helper NP'
  ]
  await Promise.all(helpers.map(helper => assertHelper(t, finalPath, expectedName, helper)))
}

async function iconTest (t, opts, icon, iconPath) {
  opts.icon = icon

  const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts)
  const outputPath = resourcesPath.replace(`${path.sep}${util.generateResourcesPath(opts)}`, '')
  const plistObj = await parseInfoPlist(t, opts, outputPath)
  await util.assertFilesEqual(t, iconPath, path.join(resourcesPath, plistObj.CFBundleIconFile), 'installed icon file should be identical to the specified icon file')
}

async function extendInfoTest (t, baseOpts, extraPathOrParams) {
  const opts = {
    ...baseOpts,
    appBundleId: 'com.electron.extratest',
    appCategoryType: 'public.app-category.music',
    buildVersion: '3.2.1',
    extendInfo: extraPathOrParams
  }

  const obj = await packageAndParseInfoPlist(t, opts)
  assertPlistStringValue(t, obj, 'TestKeyString', 'String data', 'TestKeyString should come from extendInfo')
  t.is(obj.TestKeyInt, 12345, 'TestKeyInt should come from extendInfo')
  t.is(obj.TestKeyBool, true, 'TestKeyBool should come from extendInfo')
  t.deepEqual(obj.TestKeyArray, ['public.content', 'public.data'], 'TestKeyArray should come from extendInfo')
  t.deepEqual(obj.TestKeyDict, { Number: 98765, CFBundleVersion: '0.0.0' }, 'TestKeyDict should come from extendInfo')
  assertPlistStringValue(t, obj, 'CFBundleVersion', opts.buildVersion, 'CFBundleVersion should reflect buildVersion argument')
  assertCFBundleIdentifierValue(t, obj, 'com.electron.extratest', 'CFBundleIdentifier should reflect appBundleId argument')
  assertPlistStringValue(t, obj, 'LSApplicationCategoryType', 'public.app-category.music', 'LSApplicationCategoryType should reflect appCategoryType argument')
  assertPlistStringValue(t, obj, 'CFBundlePackageType', 'APPL', 'CFBundlePackageType should be Electron default')
}

async function darkModeTest (t, baseOpts) {
  const opts = {
    ...baseOpts,
    appBundleId: 'com.electron.extratest',
    appCategoryType: 'public.app-category.music',
    buildVersion: '3.2.1',
    darwinDarkModeSupport: true
  }

  const obj = await packageAndParseInfoPlist(t, opts)
  t.is(obj.NSRequiresAquaSystemAppearance, false, 'NSRequiresAquaSystemAppearance should be set to false')
}

async function binaryNameTest (t, baseOpts, extraOpts, expectedExecutableName, expectedAppName) {
  const opts = { ...baseOpts, ...extraOpts }
  const appName = expectedAppName || expectedExecutableName || opts.name
  const executableName = expectedExecutableName || opts.name

  const finalPath = (await packager(opts))[0]
  await util.assertFile(t, path.join(finalPath, `${appName}.app`, 'Contents', 'MacOS', executableName), 'The binary should reflect a sanitized opts.name')
}

async function appVersionTest (t, opts, appVersion, buildVersion) {
  opts.appVersion = appVersion
  opts.buildVersion = buildVersion || appVersion

  const obj = await packageAndParseInfoPlist(t, opts)
  assertPlistStringValue(t, obj, 'CFBundleVersion', '' + opts.buildVersion, 'CFBundleVersion should reflect buildVersion')
  return assertPlistStringValue(t, obj, 'CFBundleShortVersionString', '' + opts.appVersion, 'CFBundleShortVersionString should reflect appVersion')
}

async function appBundleTest (t, opts, appBundleId) {
  if (appBundleId) {
    opts.appBundleId = appBundleId
  }

  const defaultBundleName = `com.electron.${opts.name.toLowerCase()}`
  const appBundleIdentifier = mac.filterCFBundleIdentifier(opts.appBundleId || defaultBundleName)
  const obj = await packageAndParseInfoPlist(t, opts)
  assertPlistStringValue(t, obj, 'CFBundleDisplayName', opts.name, 'CFBundleDisplayName should reflect opts.name')
  assertPlistStringValue(t, obj, 'CFBundleName', opts.name, 'CFBundleName should reflect opts.name')
  assertCFBundleIdentifierValue(t, obj, appBundleIdentifier, 'CFBundleName should reflect opts.appBundleId or fallback to default')
}

async function appHelpersBundleTest (t, opts, helperBundleId, appBundleId) {
  if (helperBundleId) {
    opts.helperBundleId = helperBundleId
  }
  if (appBundleId) {
    opts.appBundleId = appBundleId
  }
  const defaultBundleName = `com.electron.${opts.name.toLowerCase()}`
  const appBundleIdentifier = mac.filterCFBundleIdentifier(opts.appBundleId || defaultBundleName)
  const helperBundleIdentifier = mac.filterCFBundleIdentifier(opts.helperBundleId || appBundleIdentifier + '.helper')

  const finalPath = (await packager(opts))[0]
  const frameworksPath = path.join(finalPath, `${opts.name}.app`, 'Contents', 'Frameworks')
  const helperObj = await util.parsePlist(t, path.join(frameworksPath, `${opts.name} Helper.app`))
  assertPlistStringValue(t, helperObj, 'CFBundleName', opts.name, 'CFBundleName should reflect opts.name in helper app')
  assertCFBundleIdentifierValue(t, helperObj, helperBundleIdentifier, 'CFBundleIdentifier should reflect opts.helperBundleId, opts.appBundleId or fallback to default in helper app')

  const helperEHObj = await util.parsePlist(t, path.join(frameworksPath, `${opts.name} Helper EH.app`))
  assertPlistStringValue(t, helperEHObj, 'CFBundleName', opts.name + ' Helper EH', 'CFBundleName should reflect opts.name in helper EH app')
  assertPlistStringValue(t, helperEHObj, 'CFBundleDisplayName', opts.name + ' Helper EH', 'CFBundleDisplayName should reflect opts.name in helper EH app')
  assertPlistStringValue(t, helperEHObj, 'CFBundleExecutable', opts.name + ' Helper EH', 'CFBundleExecutable should reflect opts.name in helper EH app')
  assertCFBundleIdentifierValue(t, helperEHObj, `${helperBundleIdentifier}.EH`, 'CFBundleName should reflect opts.helperBundleId, opts.appBundleId or fallback to default in helper EH app')

  const helperNPObj = await util.parsePlist(t, path.join(frameworksPath, `${opts.name} Helper NP.app`))
  assertPlistStringValue(t, helperNPObj, 'CFBundleName', opts.name + ' Helper NP', 'CFBundleName should reflect opts.name in helper NP app')
  assertPlistStringValue(t, helperNPObj, 'CFBundleDisplayName', opts.name + ' Helper NP', 'CFBundleDisplayName should reflect opts.name in helper NP app')
  assertPlistStringValue(t, helperNPObj, 'CFBundleExecutable', opts.name + ' Helper NP', 'CFBundleExecutable should reflect opts.name in helper NP app')
  return assertCFBundleIdentifierValue(t, helperNPObj, helperBundleIdentifier + '.NP', 'CFBundleName should reflect opts.helperBundleId, opts.appBundleId or fallback to default in helper NP app')
}

if (!(process.env.CI && process.platform === 'win32')) {
  darwinTest('helper app paths test', helperAppPathsTest)
  darwinTest('helper app paths test with app name needing sanitization', helperAppPathsTest, { name: '@username/package-name' }, '@username-package-name')

  const iconBase = path.join(__dirname, 'fixtures', 'monochrome')
  const icnsPath = `${iconBase}.icns`

  darwinTest('icon test: .icns specified', iconTest, icnsPath, icnsPath)
  // This test exists because the .icns file basename changed as of 0.37.4
  electron0374Test('icon test: Electron 0.37.4, .icns specified', iconTest, icnsPath, icnsPath)
  darwinTest('icon test: .ico specified (should replace with .icns)', iconTest, `${iconBase}.ico`, icnsPath)
  darwinTest('icon test: basename only (should add .icns)', iconTest, iconBase, icnsPath)

  const extraInfoPath = path.join(__dirname, 'fixtures', 'extrainfo.plist')
  const extraInfoParams = plist.parse(fs.readFileSync(extraInfoPath).toString())

  darwinTest('extendInfo by filename test', extendInfoTest, extraInfoPath)
  darwinTest('extendInfo by params test', extendInfoTest, extraInfoParams)
  darwinTest('mojave dark mode test: should enable dark mode', darkModeTest)

  darwinTest('protocol/protocol-name argument test', async (t, opts) => {
    opts.protocols = [
      {
        name: 'Foo',
        schemes: ['foo']
      },
      {
        name: 'Bar',
        schemes: ['bar', 'baz']
      }
    ]

    const expected = [{
      CFBundleURLName: 'Foo',
      CFBundleURLSchemes: ['foo']
    }, {
      CFBundleURLName: 'Bar',
      CFBundleURLSchemes: ['bar', 'baz']
    }]

    const obj = await packageAndParseInfoPlist(t, opts)
    t.deepEqual(obj.CFBundleURLTypes, expected, 'CFBundleURLTypes did not contain specified protocol schemes and names')
  })

  test('osxNotarize argument test: missing appleId', t => {
    util.setupConsoleWarnSpy()
    const notarizeOpts = mac.createNotarizeOpts({ appleIdPassword: '' })
    t.falsy(notarizeOpts, 'does not generate options')
    util.assertWarning(t, 'WARNING: The appleId sub-property is required when using notarization, notarize will not run')
  })

  test('osxNotarize argument test: missing appleIdPassword', t => {
    util.setupConsoleWarnSpy()
    const notarizeOpts = mac.createNotarizeOpts({ appleId: '' })
    t.falsy(notarizeOpts, 'does not generate options')
    util.assertWarning(t, 'WARNING: The appleIdPassword sub-property is required when using notarization, notarize will not run')
  })

  test('osxNotarize argument test: appBundleId not overwritten', t => {
    const args = { appleId: '1', appleIdPassword: '2', appBundleId: 'no' }
    const notarizeOpts = mac.createNotarizeOpts(args, 'yes', 'appPath', true)
    t.is(notarizeOpts.appBundleId, 'yes', 'appBundleId is taken from arguments')
  })

  test('osxNotarize argument test: appPath not overwritten', t => {
    const args = { appleId: '1', appleIdPassword: '2', appPath: 'no' }
    const notarizeOpts = mac.createNotarizeOpts(args, 'appBundleId', 'yes', true)
    t.is(notarizeOpts.appPath, 'yes', 'appPath is taken from arguments')
  })

  test('osxSign argument test: default args', t => {
    const args = true
    const signOpts = mac.createSignOpts(args, 'darwin', 'out', 'version')
    t.deepEqual(signOpts, { identity: null, app: 'out', platform: 'darwin', version: 'version' })
  })

  test('osxSign argument test: identity=true sets autodiscovery mode', t => {
    const args = { identity: true }
    const signOpts = mac.createSignOpts(args, 'darwin', 'out', 'version')
    t.deepEqual(signOpts, { identity: null, app: 'out', platform: 'darwin', version: 'version' })
  })

  test('osxSign argument test: entitlements passed to electron-osx-sign', t => {
    const args = { entitlements: 'path-to-entitlements' }
    const signOpts = mac.createSignOpts(args, 'darwin', 'out', 'version')
    t.deepEqual(signOpts, { app: 'out', platform: 'darwin', version: 'version', entitlements: args.entitlements })
  })

  test('osxSign argument test: app not overwritten', t => {
    const args = { app: 'some-other-path' }
    const signOpts = mac.createSignOpts(args, 'darwin', 'out', 'version')
    t.deepEqual(signOpts, { app: 'out', platform: 'darwin', version: 'version' })
  })

  test('osxSign argument test: platform not overwritten', t => {
    const args = { platform: 'mas' }
    const signOpts = mac.createSignOpts(args, 'darwin', 'out', 'version')
    t.deepEqual(signOpts, { app: 'out', platform: 'darwin', version: 'version' })
  })

  test('osxSign argument test: binaries not set', t => {
    const args = { binaries: ['binary1', 'binary2'] }
    const signOpts = mac.createSignOpts(args, 'darwin', 'out', 'version')
    t.deepEqual(signOpts, { app: 'out', platform: 'darwin', version: 'version' })
  })

  test('force osxSign.hardenedRuntime when osxNotarize is set', t => {
    const signOpts = mac.createSignOpts({}, 'darwin', 'out', 'version', true)
    t.true(signOpts.hardenedRuntime, 'hardenedRuntime forced to true')
  })

  darwinTest('codesign test', async (t, opts) => {
    opts.osxSign = { identity: 'Developer CodeCert' }

    const finalPath = (await packager(opts))[0]
    const appPath = path.join(finalPath, opts.name + '.app')
    await util.assertDirectory(t, appPath, 'The expected .app directory should exist')
    try {
      await exec(`codesign -v ${appPath}`)
      t.pass('codesign should verify successfully')
    } catch (err) {
      const notFound = err && err.code === 127

      if (notFound) {
        console.log('codesign not installed; skipped')
      } else {
        throw err
      }
    }
  })

  darwinTest('binary naming test', binaryNameTest)
  darwinTest('sanitized binary naming test', binaryNameTest, { name: '@username/package-name' }, '@username-package-name')
  darwinTest('executableName test', binaryNameTest, { executableName: 'app-name', name: 'MyAppName' }, 'app-name', 'MyAppName')

  darwinTest('CFBundleName is the sanitized app name and CFBundleDisplayName is the non-sanitized app name', async (t, opts) => {
    const appBundleIdentifier = 'com.electron.username-package-name'
    const expectedSanitizedName = '@username-package-name'

    opts.name = '@username/package-name'

    const finalPath = (await packager(opts))[0]
    const obj = await util.parsePlist(t, path.join(finalPath, `${expectedSanitizedName}.app`))
    assertPlistStringValue(t, obj, 'CFBundleDisplayName', opts.name, 'CFBundleDisplayName should reflect opts.name')
    assertPlistStringValue(t, obj, 'CFBundleName', expectedSanitizedName, 'CFBundleName should reflect a sanitized opts.name')
    assertCFBundleIdentifierValue(t, obj, appBundleIdentifier, 'CFBundleIdentifier should reflect the sanitized opts.name')
  })

  darwinTest('app and build version test', appVersionTest, '1.1.0', '1.1.0.1234')
  darwinTest('app version test', appVersionTest, '1.1.0')
  darwinTest('app and build version integer test', appVersionTest, 12, 1234)
  darwinTest('infer app version from package.json test', async (t, opts) => {
    const obj = await packageAndParseInfoPlist(t, opts)
    assertPlistStringValue(t, obj, 'CFBundleVersion', '4.99.101', 'CFBundleVersion should reflect package.json version')
    assertPlistStringValue(t, obj, 'CFBundleShortVersionString', '4.99.101', 'CFBundleShortVersionString should reflect package.json version')
  })

  darwinTest('app categoryType test', async (t, opts) => {
    const appCategoryType = 'public.app-category.developer-tools'
    opts.appCategoryType = appCategoryType

    const obj = await packageAndParseInfoPlist(t, opts)
    assertPlistStringValue(t, obj, 'LSApplicationCategoryType', appCategoryType, 'LSApplicationCategoryType should reflect opts.appCategoryType')
  })

  darwinTest('app bundle test', appBundleTest, 'com.electron.basetest')
  darwinTest('app bundle (w/ special characters) test', appBundleTest, 'com.electron."bãśè tëßt!@#$%^&*()?\'')
  darwinTest('app bundle app-bundle-id fallback test', appBundleTest)

  darwinTest('app bundle framework symlink test', async (t, opts) => {
    const finalPath = (await packager(opts))[0]
    let frameworkPath = path.join(finalPath, `${opts.name}.app`, 'Contents', 'Frameworks', 'Electron Framework.framework')
    await util.assertDirectory(t, frameworkPath, 'Expected Electron Framework.framework to be a directory')
    await Promise.all([
      util.assertSymlink(t, path.join(frameworkPath, 'Electron Framework'), 'Expected Electron Framework.framework/Electron Framework to be a symlink'),
      util.assertSymlink(t, path.join(frameworkPath, 'Versions', 'Current'), 'Expected Electron Framework.framework/Versions/Current to be a symlink')
    ])
  })

  darwinTest('app helpers bundle test', appHelpersBundleTest, 'com.electron.basetest.helper')
  darwinTest('app helpers bundle (w/ special characters) test', appHelpersBundleTest, 'com.electron."bãśè tëßt!@#$%^&*()?\'.hęłpėr')
  darwinTest('app helpers bundle helper-bundle-id fallback to app-bundle-id test', appHelpersBundleTest, null, 'com.electron.basetest')
  darwinTest('app helpers bundle helper-bundle-id fallback to app-bundle-id (w/ special characters) test', appHelpersBundleTest, null, 'com.electron."bãśè tëßt!!@#$%^&*()?\'')
  darwinTest('app helpers bundle helper-bundle-id & app-bundle-id fallback test', appHelpersBundleTest)

  darwinTest('EH/NP helpers do not exist', async (t, baseOpts) => {
    const helpers = [
      'Helper EH',
      'Helper NP'
    ]
    const opts = {
      ...baseOpts,
      afterExtract: [(buildPath, electronVersion, platform, arch, cb) => {
        return Promise.all(helpers.map(async helper => {
          await fs.remove(getHelperAppPath(buildPath, 'Electron', helper))
          cb()
        }))
      }]
    }

    const finalPath = (await packager(opts))[0]
    await Promise.all(helpers.map(helper => util.assertPathNotExists(t, getHelperAppPath(finalPath, opts.name, helper), `${helper} should not exist`)))
  })

  darwinTest('appCopyright/NSHumanReadableCopyright test', async (t, baseOpts) => {
    const copyright = 'Copyright © 2003–2015 Organization. All rights reserved.'
    const opts = { ...baseOpts, appCopyright: copyright }

    const info = await packageAndParseInfoPlist(t, opts)
    t.is(info.NSHumanReadableCopyright, copyright, 'NSHumanReadableCopyright should reflect opts.appCopyright')
  })

  darwinTest('app named Electron packaged successfully', async (t, baseOpts) => {
    const opts = { ...baseOpts, name: 'Electron' }
    const finalPath = (await packager(opts))[0]
    const appPath = path.join(finalPath, 'Electron.app')
    await util.assertDirectory(t, appPath, 'The Electron.app folder exists')
    await util.assertFile(t, path.join(appPath, 'Contents', 'MacOS', 'Electron'), 'The Electron.app/Contents/MacOS/Electron binary exists')
  })
}
