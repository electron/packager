import { expectType } from 'tsd';
import * as packager from '..';

function completeFunction(
  buildPath: string,
  electronVersion: string,
  platform: string,
  arch: string,
  callbackFn: () => void,
): void {
  callbackFn();
}

// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
function finalizePackageTargetsFunction(targets: { arch: string; platform: string }[]): void {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ignoreFunction(path: string): boolean {
  return true;
}

expectType<Promise<string[]>>(packager({
  dir: '.',
  name: 'myapplication',
  platform: 'win32',
  arch: 'all',
  electronVersion: '0.34.0',
  win32metadata: {
    CompanyName: 'Acme CO',
    FileDescription: 'My application',
    OriginalFilename: 'myapp.exe',
    ProductName: 'Application',
    InternalName: 'roadrunner',
    'requested-execution-level': 'highestAvailable',
    'application-manifest': 'manifest.xml',
  },
}));

await packager({
  dir: '.',
  name: 'myapplication',
  electronVersion: '0.34.0',
  all: true,
  win32metadata: {
    CompanyName: 'Acme CO',
    FileDescription: 'My application',
    OriginalFilename: 'myapp.exe',
    ProductName: 'Application',
    InternalName: 'roadrunner',
    'requested-execution-level': 'requireAdministrator',
    'application-manifest': 'manifest.xml',
  },
});

await packager({
  dir: '.',
  name: 'myapplication',
  platform: 'darwin',
  arch: 'universal',
  electronVersion: '20.0.0',
  osxUniversal: {
    mergeASARs: true
  }
});

await packager({
  dir: '.',
  name: 'myapplication',
  platform: 'all',
  arch: 'all',
  electronVersion: '0.34.0',
});

await packager({
  dir: '.',
  name: 'myapplication',
  electronVersion: '0.34.0',
  all: true,
});

await packager({
  dir: '.',
  name: 'myapplication',
  electronVersion: '0.34.0',
  arch: 'arm64',
  executableName: 'myapp',
});

await packager({
  dir: '.',
  afterAsar: [completeFunction],
  afterComplete: [completeFunction],
  afterCopy: [completeFunction],
  afterCopyExtraResources: [completeFunction],
  afterExtract: [completeFunction],
  afterFinalizePackageTargets: [finalizePackageTargetsFunction],
  afterPrune: [completeFunction],
  beforeAsar: [completeFunction],
  beforeCopy: [completeFunction],
  beforeCopyExtraResources: [completeFunction],
  appCopyright: 'Copyright',
  appVersion: '1.0',
  arch: 'ia32',
  buildVersion: '1.2.3',
  download: {
    cacheRoot: './zips',
    mirrorOptions: {
      mirror: 'https://10.1.2.105/',
    },
  },
  extraResource: 'foo.js',
  icon: 'foo.ico',
  ignore: /ab+c/,
  out: 'out',
  overwrite: true,
  quiet: true,
  tmpdir: '/tmp',
  win32metadata: {
    CompanyName: 'Acme CO',
    FileDescription: 'My application',
    OriginalFilename: 'myapp.exe',
    ProductName: 'Application',
    InternalName: 'roadrunner',
    'requested-execution-level': 'asInvoker',
    'application-manifest': 'manifest.xml',
  },
});

await packager({
  dir: '.',
  arch: 'x64',
  asar: true,
  derefSymlinks: false,
  download: {
    cacheRoot: './zips',
    mirrorOptions: {
      mirror: 'https://10.1.2.105/',
    },
  },
  extraResource: ['foo.js', 'bar.js'],
  ignore: [/ab+c/, new RegExp('abc')], // eslint-disable-line prefer-regex-literals
  platform: 'darwin',
  prune: false,
  tmpdir: 'false',
  appBundleId: '123456',
  appCategoryType: 'public.app-category.developer-tools',
  extendInfo: 'plist.txt',
  helperBundleId: '23223f',
  osxSign: true,
});

await packager({
  dir: '.',
  arch: 'armv7l',
  asar: {
    ordering: 'order.txt',
    unpack: '*.js',
    unpackDir: 'sub_dir',
  },
  download: {
    cacheRoot: './zips',
    mirrorOptions: {
      mirror: 'https://10.1.2.105/',
    },
  },
  ignore: ignoreFunction,
  platform: 'linux',
});

await packager({
  dir: '.',
  arch: 'mips64el',
  electronVersion: '1.8.8',
  prebuiltAsar: 'prebuilt.asar',
  platform: 'linux',
});

await packager({
  dir: '.',
  arch: ['ia32', 'x64'],
  download: {
    cacheRoot: './zips',
    mirrorOptions: {
      mirror: 'https://10.1.2.105/',
    },
  },
  platform: 'mas',
  extendInfo: {
    foo: 'bar',
  },
  osxNotarize: {
    appleId: 'My ID',
    appleIdPassword: 'Bad Password',
  },
  osxSign: {
    identity: 'myidentity',
    optionsForFile: () => ({
      entitlements: 'path/to/my.entitlements',
    }),
  },
  protocols: [
    {
      name: 'myappproto',
      schemes: ['myapp', 'myapp2'],
    },
  ],
});
