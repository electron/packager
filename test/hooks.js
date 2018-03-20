'use strict'

const config = require('./config.json')
const hooks = require('../hooks')
const packager = require('..')
const test = require('ava')
const util = require('./_util')

function createHookTest (hookName) {
  // 2 packages will be built during this test
  util.packagerTest(`platform=all test (one arch) (${hookName} hook)`, (t, opts) => {
    let hookCalled = false
    opts.dir = util.fixtureSubdir('basic')
    opts.electronVersion = config.version
    opts.arch = 'ia32'
    opts.platform = 'all'

    opts[hookName] = [(buildPath, electronVersion, platform, arch, callback) => {
      hookCalled = true
      t.is(electronVersion, opts.electronVersion, `${hookName} electronVersion should be the same as the options object`)
      t.is(arch, opts.arch, `${hookName} arch should be the same as the options object`)
      callback()
    }]

    return packager(opts)
      .then(finalPaths => {
        t.is(finalPaths.length, 2, 'packager call should resolve with expected number of paths')
        t.true(hookCalled, `${hookName} methods should have been called`)
        return util.verifyPackageExistence(finalPaths)
      }).then(exists => t.deepEqual(exists, [true, true], 'Packages should be generated for both 32-bit platforms'))
  })
}

createHookTest('afterCopy')
createHookTest('afterPrune')
createHookTest('afterExtract')

test('promisifyHooks executes functions in parallel', t => {
  let output = '0'
  const timeoutFunc = (number, msTimeout) => {
    return done => {
      setTimeout(() => {
        output += ` ${number}`
        done()
      }, msTimeout)
    }
  }
  const testHooks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(number =>
    timeoutFunc(number, number % 2 === 0 ? 1000 : 0)
  )

  return hooks.promisifyHooks(testHooks)
    .then(() => t.not(output, '0 1 2 3 4 5 6 7 8 9 10', 'should not be in sequential order'))
})

test('serialHooks executes functions serially', t => {
  let output = '0'
  const timeoutFunc = (number, msTimeout) => {
    return () => new Promise(resolve => { // eslint-disable-line promise/avoid-new
      setTimeout(() => {
        output += ` ${number}`
        resolve()
      }, msTimeout)
    })
  }
  const testHooks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(number =>
    timeoutFunc(number, number % 2 === 0 ? 1000 : 0)
  )

  return hooks.serialHooks(testHooks)(() => output)
    .then(result => t.is(result, '0 1 2 3 4 5 6 7 8 9 10', 'should be in sequential order'))
})
