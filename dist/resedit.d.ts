import { Win32MetadataOptions } from './types';
export type ExeMetadata = {
    productVersion?: string;
    fileVersion?: string;
    legalCopyright?: string;
    productName?: string;
    iconPath?: string;
    win32Metadata?: Win32MetadataOptions;
};
export declare function resedit(exePath: string, options: ExeMetadata): Promise<void>;
