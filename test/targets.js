'use strict'

const config = require('./config.json')
const sinon = require('sinon')
const { allOfficialArchsForPlatformAndVersion, createPlatformArchPairs, osModules, supported, validateListFromOptions } = require('../dist/targets')
const test = require('ava')
const util = require('./_util')

function createMultiTargetOptions (extraOpts) {
  return {
    name: 'targetTest',
    dir: util.fixtureSubdir('basic'),
    electronVersion: config.version,
    ...extraOpts
  }
}

function testMultiTarget (extraOpts, expectedPackageCount, packageExistenceMessage) {
  return t => {
    const opts = createMultiTargetOptions(extraOpts)
    const platforms = validateListFromOptions(opts, 'platform')
    const archs = validateListFromOptions(opts, 'arch')
    const combinations = createPlatformArchPairs(opts, platforms, archs)

    t.is(combinations.length, expectedPackageCount, packageExistenceMessage)
  }
}

function testCombinations (testcaseDescription, arch, platform) {
  testMultiTarget(testcaseDescription, { arch: arch, platform: platform }, 4,
                  'Packages should be generated for all combinations of specified archs and platforms')
}

test('allOfficialArchsForPlatformAndVersion is undefined for unknown platforms', t => {
  t.is(allOfficialArchsForPlatformAndVersion('unknown', '1.0.0'), undefined)
})

test('allOfficialArchsForPlatformAndVersion returns the correct arches for a known platform', t => {
  t.deepEqual(allOfficialArchsForPlatformAndVersion('darwin', '1.0.0'), ['x64'])
})

test('allOfficialArchsForPlatformAndVersion returns linux/arm64 when the correct version is specified', t => {
  t.true(allOfficialArchsForPlatformAndVersion('linux', '1.8.0').includes('arm64'),
         'should be found when version is >= 1.8.0')
  t.false(allOfficialArchsForPlatformAndVersion('linux', '1.7.0').includes('arm64'),
          'should not be found when version is < 1.8.0')
})

test('allOfficialArchsForPlatformAndVersion returns linux/mips64el when the correct version is specified', t => {
  t.true(allOfficialArchsForPlatformAndVersion('linux', '1.8.2').includes('mips64el'),
         'should be found when version is >= 1.8.2-beta.5')
  t.false(allOfficialArchsForPlatformAndVersion('linux', '1.8.0').includes('mips64el'),
          'should not be found when version is < 1.8.2-beta.5')
})

test('allOfficialArchsForPlatformAndVersion returns win32/arm64 when the correct version is specified', t => {
  t.true(allOfficialArchsForPlatformAndVersion('win32', '6.0.8').includes('arm64'),
         'should be found when version is >= 6.0.8')
  t.false(allOfficialArchsForPlatformAndVersion('win32', '5.0.0').includes('arm64'),
          'should not be found when version is < 6.0.8')
})

test('validateListFromOptions does not take non-Array/String values', t => {
  supported.digits = new Set(['64', '65'])
  t.false(validateListFromOptions({ digits: 64 }, 'digits') instanceof Array,
          'should not be an Array')
  delete supported.digits
})

test('validateListFromOptions works for armv7l host and target arch', t => {
  sinon.stub(process, 'arch').value('arm')
  sinon.stub(process, 'config').value({ variables: { arm_version: '7' } })

  t.deepEqual(validateListFromOptions({}, 'arch'), ['armv7l'])

  sinon.restore()
})

test('build for all available official targets',
     testMultiTarget({ all: true, electronVersion: '1.8.2' }, util.allPlatformArchCombosCount - 5,
                     'Packages should be generated for all possible platforms (except win32/arm64)'))
test('build for all available official targets for a version without arm64 or mips64el support',
     testMultiTarget({ all: true, electronVersion: '1.4.13' }, util.allPlatformArchCombosCount - 7,
                     'Packages should be generated for all possible platforms (except linux/arm64, linux/mips64el, or win32/arm64)'))
test('platform=all (one arch)',
     testMultiTarget({ arch: 'ia32', platform: 'all', electronVersion: '1.4.13' }, 2, 'Packages should be generated for both 32-bit platforms'))
test('arch=all (one platform)',
     testMultiTarget({ arch: 'all', platform: 'linux' }, 3, 'Packages should be generated for all expected architectures'))

testCombinations('multi-platform / multi-arch test, from arrays', ['ia32', 'x64'], ['linux', 'win32'])
testCombinations('multi-platform / multi-arch test, from strings', 'ia32,x64', 'linux,win32')
testCombinations('multi-platform / multi-arch test, from strings with spaces', 'ia32, x64', 'linux, win32')

test('fails with invalid arch', util.invalidOptionTest({
  arch: 'z80',
  platform: 'linux'
}))
test('fails with invalid platform', util.invalidOptionTest({
  arch: 'ia32',
  platform: 'dos'
}))

test('invalid official combination', testMultiTarget({ arch: 'ia32', platform: 'darwin' }, 0, 'Package should not be generated for invalid official combination'))

test('platform=linux and arch=arm64 with a supported official Electron version', testMultiTarget({ arch: 'arm64', platform: 'linux', electronVersion: '1.8.0' }, 1, 'Package should be generated for linux/arm64'))
test('platform=linux and arch=arm64 with a supported official Electron version (11.0.0-beta.22)', testMultiTarget({ arch: 'arm64', platform: 'linux' }, 1, 'Package should be generated for linux/arm64'))
test('platform=linux and arch=arm64 with an unsupported official Electron version', testMultiTarget({ arch: 'arm64', platform: 'linux', electronVersion: '1.4.13' }, 0, 'Package should not be generated for linux/arm64'))

test('platform=linux and arch=ia32 with a supported official Electron version', testMultiTarget({ arch: 'ia32', platform: 'linux', electronVersion: '10.0.0' }, 1, 'Package should be generated for linux/ia32'))
test('platform=linux and arch=ia32 with an unsupported official Electron version (19.0.0-beta.1)', testMultiTarget({ arch: 'ia32', platform: 'linux', electronVersion: '19.0.0-beta.1' }, 0, 'Package should not be generated for linux/ia32'))
test('platform=linux and arch=ia32 with an unsupported official Electron version', testMultiTarget({ arch: 'ia32', platform: 'linux', electronVersion: '20.0.0' }, 0, 'Package should not be generated for linux/ia32'))

test('platform=linux and arch=mips64el with a supported official Electron version', testMultiTarget({ arch: 'mips64el', platform: 'linux', electronVersion: '1.8.2-beta.5' }, 1, 'Package should be generated for mips64el'))
test('platform=linux and arch=mips64el with an unsupported official Electron version', testMultiTarget({ arch: 'mips64el', platform: 'linux' }, 0, 'Package should not be generated for linux/mips64el'))
test('platform=linux and arch=mips64el with an unsupported official Electron version (2.0.0)', testMultiTarget({ arch: 'mips64el', platform: 'linux', electronVersion: '2.0.0' }, 0, 'Package should not be generated for linux/mips64el'))

test('platform=win32 and arch=arm64 with a supported official Electron version', testMultiTarget({ arch: 'arm64', platform: 'win32' }, 1, 'Package should be generated for win32/arm64'))
test('platform=win32 and arch=arm64 with an unsupported official Electron version', testMultiTarget({ arch: 'arm64', platform: 'win32', electronVersion: '1.4.13' }, 0, 'Package should not be generated for win32/arm64'))

test('platform=darwin and arch=arm64 with a supported official Electron version', testMultiTarget({ arch: 'arm64', platform: 'darwin' }, 1, 'Package should be generated for darwin/arm64'))
test('platform=darwin and arch=arm64 with an unsupported official Electron version', testMultiTarget({ arch: 'arm64', platform: 'darwin', electronVersion: '1.4.13' }, 0, 'Package should not be generated for darwin/arm64'))

test('platform=mas and arch=arm64 with a supported official Electron version', testMultiTarget({ arch: 'arm64', platform: 'mas' }, 1, 'Package should be generated for mas/arm64'))
test('platform=mas and arch=arm64 with an unsupported official Electron version', testMultiTarget({ arch: 'arm64', platform: 'mas', electronVersion: '1.4.13' }, 0, 'Package should not be generated for mas/arm64'))

test('platform=darwin and arch=universal with a supported official Electron version', testMultiTarget({ arch: 'universal', platform: 'darwin' }, 1, 'Package should be generated for darwin/universal'))
test('platform=darwin and arch=universal with an unsupported official Electron version', testMultiTarget({ arch: 'universal', platform: 'darwin', electronVersion: '1.4.13' }, 0, 'Package should not be generated for darwin/universal'))

test('platform=mas and arch=universal with a supported official Electron version', testMultiTarget({ arch: 'universal', platform: 'mas' }, 1, 'Package should be generated for mas/universal'))
test('platform=mas and arch=universal with an unsupported official Electron version', testMultiTarget({ arch: 'universal', platform: 'mas', electronVersion: '1.4.13' }, 0, 'Package should not be generated for mas/universal'))

test('unofficial arch', testMultiTarget({ arch: 'z80', platform: 'linux', download: { mirrorOptions: { mirror: 'mirror' } } }, 1,
                                        'Package should be generated for non-standard arch from non-official mirror'))
test('unofficial platform', testMultiTarget({ arch: 'ia32', platform: 'minix', download: { mirrorOptions: { mirror: 'mirror' } } }, 1,
                                            'Package should be generated for non-standard platform from non-official mirror'))
