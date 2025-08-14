import fs from 'fs-extra';

vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// expect extenders for filesystem stuff
expect.extend({
  toBeDirectory(received) {
    const pass = fs.statSync(received).isDirectory();
    if (pass) {
      return {
        message: () => `expected ${received} not to be a directory`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a directory`,
        pass: false,
      };
    }
  },
  toBeFile(received) {
    const pass = fs.statSync(received).isFile();
    if (pass) {
      return {
        message: () => `expected ${received} not to be a file`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a file`,
        pass: false,
      };
    }
  },
  toBeSymlink(received) {
    const pass = fs.lstatSync(received).isSymbolicLink();
    if (pass) {
      return {
        message: () => `expected ${received} not to be a symlink`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a symlink`,
        pass: false,
      };
    }
  },
});
