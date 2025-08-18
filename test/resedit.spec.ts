import { WindowsApp } from '../src/win32';
import _ from 'lodash';

describe('resedit', () => {
  it('sets win32Metadata defaults', async () => {
    const opts = { name: 'Win32 App', arch: 'x64', platform: 'win32', dir: '' };
    const app = new WindowsApp(opts, '');
    const rcOpts = app.generateReseditOptionsSansIcon();

    expect(rcOpts.win32Metadata?.FileDescription).toBe(opts.name);
    expect(rcOpts.win32Metadata?.InternalName).toBe(opts.name);
    expect(rcOpts.win32Metadata?.OriginalFilename).toBe('Win32 App.exe');
    expect(rcOpts.productName).toBe(opts.name);
  });

  it.each([
    {
      testOpts: { appVersion: '4.99.101.0', buildVersion: '101.0.4995.101' },
      expectedValues: {
        fileVersion: '101.0.4995.101',
        productVersion: '4.99.101.0',
      },
    },
    {
      testOpts: { appVersion: '4.99.101.0' },
      expectedValues: {
        fileVersion: '4.99.101.0',
        productVersion: '4.99.101.0',
      },
    },
    {
      testOpts: { appCopyright: 'Copyright Bar' },
      expectedValues: {
        legalCopyright: 'Copyright Bar',
      },
    },
    {
      testOpts: {
        win32metadata: { CompanyName: 'Foo' },
      },
      expectedValues: {
        'win32Metadata.CompanyName': 'Foo',
      },
    },
    {
      testOpts: {
        win32metadata: {
          'requested-execution-level': 'asInvoker' as const,
        },
      },
      expectedValues: {
        'win32Metadata.requested-execution-level': 'asInvoker',
      },
    },
    {
      testOpts: {
        win32metadata: {
          'application-manifest': '/path/to/manifest.xml',
        },
      },
      expectedValues: {
        'win32Metadata.application-manifest': '/path/to/manifest.xml',
      },
    },
  ])(
    'sets the right version string for $testOpts',
    async ({ testOpts, expectedValues }) => {
      const opts = {
        name: 'Win32 App',
        arch: 'x64',
        platform: 'win32',
        dir: '',
        ...testOpts,
      };
      const app = new WindowsApp(opts, '');
      const rcOpts = app.generateReseditOptionsSansIcon();

      for (const [key, value] of Object.entries(expectedValues)) {
        expect(_.get(rcOpts, key)).toBe(value);
      }
    },
  );
});
