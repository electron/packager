'use strict'

const path = require('path')
const prune = require('../src/prune')
const test = require('ava')
const util = require('./_util')

async function checkDependency (t, resourcesPath, moduleName, moduleExists) {
  const assertion = moduleExists ? 'should' : 'should NOT'
  const message = `module dependency '${moduleName}' ${assertion} exist under app/node_modules`
  const modulePath = path.join(resourcesPath, 'app', 'node_modules', moduleName)
  await util.assertPathExistsCustom(t, modulePath, moduleExists, message)
  return modulePath
}

async function assertDependencyExists (t, resourcesPath, moduleName) {
  const modulePath = await checkDependency(t, resourcesPath, moduleName, true)
  await util.assertDirectory(t, modulePath, 'module is a directory')
}

async function createPruneOptionTest (t, baseOpts, prune, testMessage) {
  const opts = {
    ...baseOpts,
    name: 'pruneTest',
    dir: util.fixtureSubdir('basic'),
    prune: prune
  }

  const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts)
  await Promise.all([
    assertDependencyExists(t, resourcesPath, 'run-series'),
    assertDependencyExists(t, resourcesPath, '@types/node'),
    checkDependency(t, resourcesPath, 'run-waterfall', !prune),
    checkDependency(t, resourcesPath, 'electron-prebuilt', !prune)
  ])
}

test.serial('prune test', util.testSinglePlatform(async (t, baseOpts) => {
  await createPruneOptionTest(t, baseOpts, true, 'package.json devDependency should NOT exist under app/node_modules')
}))

test.serial('prune electron in dependencies', util.testSinglePlatform(async (t, baseOpts) => {
  const opts = {
    ...baseOpts,
    name: 'pruneElectronTest',
    dir: util.fixtureSubdir('electron-in-dependencies')
  }

  const resourcesPath = await util.packageAndEnsureResourcesPath(t, opts)
  await checkDependency(t, resourcesPath, 'electron', false)
}))

test.serial('prune: false test', util.testSinglePlatform(createPruneOptionTest, false, 'package.json devDependency should exist under app/node_modules'))

test('isModule properly detects module folders', async t => {
  const isModule = name => prune.isModule(util.fixtureSubdir(path.join('prune-is-module', 'node_modules', name)))
  const [mod, notMod, namespaced] = await Promise.all([isModule('module'), isModule('not-module'), isModule('@user/namespaced')])
  t.true(mod, 'module folder should be detected as module')
  t.false(notMod, 'not-module subfolder should not be detected as module')
  t.true(namespaced, '@user/namespaced folder should be detected as module')
})
