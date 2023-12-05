import { App } from './platform';
import { Options as RceditOptions } from 'rcedit';
export declare function updateWineMissingException(err: Error): Error;
export declare class WindowsApp extends App {
    get originalElectronName(): string;
    get newElectronName(): string;
    get electronBinaryPath(): string;
    generateRceditOptionsSansIcon(): RceditOptions;
    getIconPath(): Promise<string | void>;
    needsRcedit(): boolean;
    runRcedit(): Promise<void>;
    signAppIfSpecified(): Promise<void>;
    create(): Promise<string>;
}
export { WindowsApp as App };
