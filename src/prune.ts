import { normalizePath, warning } from './common';
import galactus from 'galactus';
import fs from 'fs-extra';
import path from 'path';

const ELECTRON_MODULES = [
  'electron',
  'electron-nightly'
];

export class Pruner {
  constructor(dir, quiet) {
    this.baseDir = normalizePath(dir);
    this.quiet = quiet;
    this.galactus = new galactus.DestroyerOfModules({
      rootDirectory: dir,
      shouldKeepModuleTest: (module, isDevDep) => this.shouldKeepModule(module, isDevDep)
    });
    this.walkedTree = false;
  }

  setModules(moduleMap) {
    const modulePaths = Array.from(moduleMap.keys()).map(modulePath => `/${normalizePath(modulePath)}`);
    this.modules = new Set(modulePaths);
    this.walkedTree = true;
  }

  async pruneModule(name) {
    if (this.walkedTree) {
      return this.isProductionModule(name);
    } else {
      const moduleMap = await this.galactus.collectKeptModules({ relativePaths: true });
      this.setModules(moduleMap);
      return this.isProductionModule(name);
    }
  }

  shouldKeepModule(module, isDevDep) {
    if (isDevDep || module.depType === galactus.DepType.ROOT) {
      return false;
    }

    if (ELECTRON_MODULES.includes(module.name)) {
      warning(`Found '${module.name}' but not as a devDependency, pruning anyway`, this.quiet);
      return false;
    }

    return true;
  }

  isProductionModule(name) {
    return this.modules.has(name);
  }
}

function isNodeModuleFolder(pathToCheck) {
  return path.basename(path.dirname(pathToCheck)) === 'node_modules' ||
    (path.basename(path.dirname(pathToCheck)).startsWith('@') && path.basename(path.resolve(pathToCheck, `..${path.sep}..`)) === 'node_modules');
}

export async function isModule(pathToCheck) {
  return (await fs.pathExists(path.join(pathToCheck, 'package.json'))) && isNodeModuleFolder(pathToCheck);
}
