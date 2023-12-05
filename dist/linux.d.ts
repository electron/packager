import { App } from './platform';
export declare class LinuxApp extends App {
    get originalElectronName(): string;
    get newElectronName(): string;
    create(): Promise<string>;
}
export { LinuxApp as App };
