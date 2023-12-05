import { serialHooks } from './hooks';
import { packager } from './packager';
import { allOfficialArchsForPlatformAndVersion } from './targets';
export default packager;
export { allOfficialArchsForPlatformAndVersion, packager, serialHooks };
export * from './types';
