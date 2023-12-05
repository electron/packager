import { normalizePath, warning } from './common';
import { DestroyerOfModules, DepType, Module, ModuleMap } from 'galactus';
import fs from 'fs-extra';
import path from 'path';

const ELECTRON_MODULES = [
  'electron',
  'electron-nightly'
];

export class Pruner {
  baseDir: string;
  galactus: DestroyerOfModules;
  modules = new Set<string>();
  quiet: boolean;
  walkedTree = false;

  constructor(dir: string, quiet: boolean) {
    this.baseDir = normalizePath(dir);
    this.quiet = quiet;
    this.galactus = new DestroyerOfModules({
      rootDirectory: dir,
      shouldKeepModuleTest: (module, isDevDep) => this.shouldKeepModule(module, isDevDep)
    });
  }

  setModules(moduleMap: ModuleMap) {
    const modulePaths = Array.from(moduleMap.keys()).map(modulePath => `/${normalizePath(modulePath)}`);
    this.modules = new Set(modulePaths);
    this.walkedTree = true;
  }

  async pruneModule(name: string) {
    if (this.walkedTree) {
      return this.isProductionModule(name);
    } else {
      const moduleMap = await this.galactus.collectKeptModules({ relativePaths: true });
      this.setModules(moduleMap);
      return this.isProductionModule(name);
    }
  }

  shouldKeepModule(module: Module, isDevDep: boolean) {
    if (isDevDep || module.depType === DepType.ROOT) {
      return false;
    }

    if (ELECTRON_MODULES.includes(module.name)) {
      warning(`Found '${module.name}' but not as a devDependency, pruning anyway`, this.quiet);
      return false;
    }

    return true;
  }

  isProductionModule(name: string) {
    return this.modules.has(name);
  }
}

function isNodeModuleFolder(pathToCheck: string) {
  return path.basename(path.dirname(pathToCheck)) === 'node_modules' ||
    (path.basename(path.dirname(pathToCheck)).startsWith('@') && path.basename(path.resolve(pathToCheck, `..${path.sep}..`)) === 'node_modules');
}

export async function isModule(pathToCheck: string) {
  return (await fs.pathExists(path.join(pathToCheck, 'package.json'))) && isNodeModuleFolder(pathToCheck);
}
