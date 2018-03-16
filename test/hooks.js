'use strict'

const config = require('./config.json')
const packager = require('..')
const util = require('./_util')

function createHookTest (hookName) {
  // 2 packages will be built during this test
  util.packagerTest(`platform=all test (one arch) (${hookName} hook)`, (t, opts) => {
    let fn1 = false
    let fn2 = false
    let fn3 = false

    opts.dir = util.fixtureSubdir('basic')
    opts.electronVersion = config.version
    opts.arch = 'ia32'
    opts.platform = 'all'

    opts[hookName] = [
      (buildPath, electronVersion, platform, arch, callback) => {
        fn1 = false
        fn2 = false
        fn3 = false
        callback()
      },
      (buildPath, electronVersion, platform, arch, callback) => {
        t.is(electronVersion, opts.electronVersion, `${hookName} electronVersion should be the same as the options object`)
        t.is(arch, opts.arch, `${hookName} arch should be the same as the options object`)
        setTimeout(() => {
          fn1 = true
          callback()
        })
      },
      (buildPath, electronVersion, platform, arch, callback) => {
        t.true(fn1, 'second hook executes after the first')
        t.false(fn3, 'second hook executes before the third')
        setTimeout(() => {
          fn2 = true
          callback()
        })
      },
      (buildPath, electronVersion, platform, arch, callback) => {
        t.true(fn1 && fn2, 'third hook executes after the first and second')
        setTimeout(() => {
          fn3 = true
          callback()
        })
      }
    ]

    return packager(opts)
      .then(finalPaths => {
        t.is(finalPaths.length, 2, 'packager call should resolve with expected number of paths')
        t.true(fn1 && fn2 && fn3, `${hookName} methods should have been called`)
        return util.verifyPackageExistence(finalPaths)
      }).then(exists => t.deepEqual(exists, [true, true], 'Packages should be generated for both 32-bit platforms'))
  })
}

createHookTest('afterCopy')
createHookTest('afterPrune')
createHookTest('afterExtract')
