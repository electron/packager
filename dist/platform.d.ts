import { FileRecord } from '@electron/asar';
import { createAsarOpts } from './common';
import { ComboOptions } from './types';
export declare class App {
    asarIntegrity: Record<string, Pick<FileRecord['integrity'], 'algorithm' | 'hash'>> | undefined;
    asarOptions: ReturnType<typeof createAsarOpts>;
    cachedStagingPath: string | undefined;
    opts: ComboOptions;
    templatePath: string;
    constructor(opts: ComboOptions, templatePath: string);
    create(): Promise<string>;
    /**
     * Resource directory path before renaming.
     */
    get originalResourcesDir(): string;
    /**
     * Resource directory path after renaming.
     */
    get resourcesDir(): string;
    get originalResourcesAppDir(): string;
    get electronBinaryDir(): string;
    get originalElectronName(): string;
    get newElectronName(): string;
    get executableName(): string | undefined;
    get stagingPath(): string;
    get appAsarPath(): string;
    get commonHookArgs(): (string | string[] | undefined)[];
    get hookArgsWithOriginalResourcesAppDir(): (string | string[] | undefined)[];
    relativeRename(basePath: string, oldName: string, newName: string): Promise<void>;
    renameElectron(): Promise<void>;
    /**
     * Performs the following initial operations for an app:
     * * Creates temporary directory
     * * Remove default_app (which is either a folder or an asar file)
     * * If a prebuilt asar is specified:
     *   * Copies asar into temporary directory as app.asar
     * * Otherwise:
     *   * Copies template into temporary directory
     *   * Copies user's app into temporary directory
     *   * Prunes non-production node_modules (if opts.prune is either truthy or undefined)
     *   * Creates an asar (if opts.asar is set)
     *
     * Prune and asar are performed before platform-specific logic, primarily so that
     * this.originalResourcesAppDir is predictable (e.g. before .app is renamed for Mac)
     */
    initialize(): Promise<void>;
    buildApp(): Promise<void>;
    copyTemplate(): Promise<void>;
    removeDefaultApp(): Promise<void>;
    /**
     * Forces an icon filename to a given extension and returns the normalized filename,
     * if it exists.  Otherwise, returns null.
     *
     * This error path is used by win32 if no icon is specified.
     */
    normalizeIconExtension(targetExt: string): Promise<string | undefined>;
    prebuiltAsarWarning(option: keyof ComboOptions, triggerWarning: unknown): void;
    copyPrebuiltAsar(): Promise<void>;
    appRelativePath(p: string): string;
    asarApp(): Promise<void>;
    copyExtraResources(): Promise<void>;
    move(): Promise<string>;
}
