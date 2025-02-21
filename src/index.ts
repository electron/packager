import { serialHooks } from './hooks';
import { packager } from './packager';
import { allOfficialArchsForPlatformAndVersion } from './targets';

export default packager;

export { allOfficialArchsForPlatformAndVersion, packager, serialHooks };

export * from './types';

module.exports = packager;
module.exports.allOfficialArchsForPlatformAndVersion =
  allOfficialArchsForPlatformAndVersion;
module.exports.packager = packager;
module.exports.serialHooks = serialHooks;
module.exports.default = packager;
