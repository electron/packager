'use strict'

const config = require('./config.json')
const { promisifyHooks, serialHooks } = require('../dist/hooks')
const { packager } = require('../dist')
const test = require('ava')
const util = require('./_util')

async function hookTest (wantHookCalled, hookName, t, opts, validator) {
  let hookCalled = false
  opts.dir = util.fixtureSubdir('basic')
  opts.electronVersion = '1.4.13'
  opts.arch = 'ia32'
  opts.platform = 'all'

  opts[hookName] = [validator
    ? (...args) => {
      hookCalled = true
      validator(t, ...args)
    }
    : (buildPath, electronVersion, platform, arch, callback) => {
      hookCalled = true
      t.is(electronVersion, opts.electronVersion, `${hookName} electronVersion should be the same as the options object`)
      t.is(arch, opts.arch, `${hookName} arch should be the same as the options object`)
      callback()
    }]

  // 2 packages will be built during this test
  const finalPaths = await packager(opts)
  t.is(finalPaths.length, 2, 'packager call should resolve with expected number of paths')
  t.is(wantHookCalled, hookCalled, `${hookName} methods ${wantHookCalled ? 'should' : 'should not'} have been called`)
  const exists = await util.verifyPackageExistence(finalPaths)
  t.deepEqual(exists, [true, true], 'Packages should be generated for both 32-bit platforms')
}

function createHookTest (hookName, validator) {
  return util.packagerTest(async (t, opts) => hookTest(true, hookName, t, opts, validator))
}

test.serial('platform=all (one arch) for beforeCopy hook', createHookTest('beforeCopy'))
test.serial('platform=all (one arch) for afterCopy hook', createHookTest('afterCopy'))
test.serial('platform=all (one arch) for afterFinalizePackageTargets hook', createHookTest('afterFinalizePackageTargets', (t, targets, callback) => {
  t.is(targets.length, 2, 'target list should have two items')
  t.is(targets[0].arch, 'ia32')
  t.is(targets[0].platform, 'linux')
  t.is(targets[1].arch, 'ia32')
  t.is(targets[1].platform, 'win32')
  callback()
}))
test.serial('platform=all (one arch) for afterPrune hook', createHookTest('afterPrune'))
test.serial('platform=all (one arch) for afterExtract hook', createHookTest('afterExtract'))
test.serial('platform=all (one arch) for afterComplete hook', createHookTest('afterComplete'))

test('promisifyHooks executes functions in parallel', async t => {
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

  await promisifyHooks(testHooks)
  t.not(output, '0 1 2 3 4 5 6 7 8 9 10', 'should not be in sequential order')
})

test('serialHooks executes functions serially', async t => {
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

  const result = await serialHooks(testHooks)(() => output)
  t.is(result, '0 1 2 3 4 5 6 7 8 9 10', 'should be in sequential order')
})

test.serial('prune hook does not get called when prune=false', util.packagerTest((t, opts) => {
  opts.prune = false
  return hookTest(false, 'afterPrune', t, opts)
}))
