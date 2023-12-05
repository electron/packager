import { DestroyerOfModules, Module, ModuleMap } from 'galactus';
export declare class Pruner {
    baseDir: string;
    galactus: DestroyerOfModules;
    modules: Set<string>;
    quiet: boolean;
    walkedTree: boolean;
    constructor(dir: string, quiet: boolean);
    setModules(moduleMap: ModuleMap): void;
    pruneModule(name: string): Promise<boolean>;
    shouldKeepModule(module: Module, isDevDep: boolean): boolean;
    isProductionModule(name: string): boolean;
}
export declare function isModule(pathToCheck: string): Promise<boolean>;
