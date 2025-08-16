'use strict';

module.exports = {
  dynamicImport: async (mod) => {
    return await import(mod);
  },
};
