'use strict'

const config = require('./config.json')
const packager = require('..')
const pify = require('pify')
const util = require('./util')

function createMultiTargetOptions (extraOpts) {
  return Object.assign({
    name: 'basicTest',
    dir: util.fixtureSubdir('basic'),
    electronVersion: config.version
  }, extraOpts)
}

function createMultiTargetPromise (t, opts, expectedPackageCount, packageExistenceMessage) {
  pify(packager)(opts)
    .then(finalPaths => {
      t.equal(finalPaths.length, expectedPackageCount,
              'packager call should resolve with expected number of paths')
      return util.verifyPackageExistence(finalPaths)
    }).then(exists => {
      t.true(exists, packageExistenceMessage)
      return t.end()
    }).catch(t.end)
}

function createMultiTargetTest (extraOpts, expectedPackageCount, packageExistenceMessage) {
  return (t) => {
    t.timeoutAfter(config.timeout * expectedPackageCount)

    const opts = createMultiTargetOptions(extraOpts)
    createMultiTargetPromise(t, opts, expectedPackageCount, packageExistenceMessage)
  }
}

function createMultiTest (arch, platform) {
  return createMultiTargetTest({arch: arch, platform: platform}, 4,
                               'Packages should be generated for all combinations of specified archs and platforms')
}

util.packagerTest('all test', (t) => {
  const EXPECTED_PACKAGES = 7
  const opts = createMultiTargetOptions({all: true})
  const message = 'Packages should be generated for all possible platforms'

  return createMultiTargetPromise(t, opts, EXPECTED_PACKAGES, message)
})

util.packagerTest('platform=all test (one arch)',
                  createMultiTargetTest({arch: 'ia32', platform: 'all'}, 2, 'Packages should be generated for both 32-bit platforms'))
util.packagerTest('arch=all test (one platform)',
                  createMultiTargetTest({arch: 'all', platform: 'linux'}, 3, 'Packages should be generated for all expected architectures'))
util.packagerTest('multi-platform / multi-arch test, from arrays', createMultiTest(['ia32', 'x64'], ['linux', 'win32']))
util.packagerTest('multi-platform / multi-arch test, from strings', createMultiTest('ia32,x64', 'linux,win32'))
