'use strict'

const packager = require('..')
const path = require('path')
const test = require('ava')
const util = require('./_util')

if (!(process.env.CI && process.platform === 'win32')) {
  const masOpts = {
    name: 'masTest',
    dir: util.fixtureSubdir('basic'),
    electronVersion: '2.0.0-beta.1',
    arch: 'x64',
    platform: 'mas'
  }

  test.serial('warn if building for mas and not signing', util.packagerTest(async (t, baseOpts) => {
    util.setupConsoleWarnSpy()
    await packager({ ...baseOpts, ...masOpts })
    util.assertWarning(t, 'WARNING: signing is required for mas builds. Provide the osx-sign option, or manually sign the app later.')
  }))

  test.serial('update Login Helper if it exists', util.packagerTest(async (t, baseOpts) => {
    const helperName = `${masOpts.name} Login Helper`
    const finalPath = (await packager({ ...baseOpts, ...masOpts }))[0]
    const helperPath = path.join(finalPath, `${masOpts.name}.app`, 'Contents', 'Library', 'LoginItems', `${helperName}.app`)
    const contentsPath = path.join(helperPath, 'Contents')
    await util.assertPathExists(t, helperPath, 'renamed Login Helper app exists')
    const plistData = await util.parsePlist(t, helperPath)
    t.is(plistData.CFBundleExecutable, helperName, 'CFBundleExecutable is renamed Login Helper')
    t.is(plistData.CFBundleName, helperName, 'CFBundleName is renamed Login Helper')
    t.is(plistData.CFBundleIdentifier, 'com.electron.mastest.loginhelper')
    await util.assertPathExists(t, path.join(contentsPath, 'MacOS', helperName), 'renamed Login Helper executable exists')
  }))
}
