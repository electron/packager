'use strict'

const common = require('./common')
const galactus = require('galactus')
const fs = require('fs-extra')
const path = require('path')

const ELECTRON_MODULES = [
  'electron',
  'electron-prebuilt',
  'electron-prebuilt-compile'
]

class Pruner {
  constructor (dir) {
    this.baseDir = common.normalizePath(dir)
    this.galactus = new galactus.DestroyerOfModules({
      rootDirectory: dir,
      shouldKeepModuleTest: (module, isDevDep) => this.shouldKeepModule(module, isDevDep)
    })
    this.walkedTree = false
  }

  setModuleMap (moduleMap) {
    this.moduleMap = new Map()
    // destructured assignments are in Node 6
    for (const modulePair of moduleMap) {
      const modulePath = modulePair[0]
      const module = modulePair[1]
      this.moduleMap.set(`/${common.normalizePath(modulePath)}`, module)
    }
    this.walkedTree = true
  }

  pruneModule (name) {
    if (this.walkedTree) {
      return this.isProductionModule(name)
    } else {
      return this.galactus.collectKeptModules({ relativePaths: true })
        .then(moduleMap => this.setModuleMap(moduleMap))
        .then(() => this.isProductionModule(name))
    }
  }

  shouldKeepModule (module, isDevDep) {
    if (isDevDep || module.depType === galactus.DepType.ROOT) {
      return false
    }

    // Node 6 has Array.prototype.includes
    if (ELECTRON_MODULES.indexOf(module.name) !== -1) {
      common.warning(`Found '${module.name}' but not as a devDependency, pruning anyway`)
      return false
    }

    return true
  }

  isProductionModule (name) {
    return !!this.moduleMap.get(name)
  }
}

module.exports = {
  isModule: function isModule (pathToCheck) {
    return fs.pathExists(path.join(pathToCheck, 'package.json'))
  },
  Pruner: Pruner
}
