import { parseArgs } from '../src/cli.js';
import { describe, it, expect } from 'vitest';

describe('parseArgs', () => {
  it('populates opts.electronVersion', () => {
    const emptyArgs = parseArgs([]);
    expect(emptyArgs.electronVersion).toBeUndefined();
    const argsWithVersion = parseArgs(['--electron-version=1.2.3']);
    expect(argsWithVersion.electronVersion).toBe('1.2.3');
  });

  it('populates opts.asar', () => {
    const args = parseArgs(['--asar=true']);
    expect(args.asar).toBe(true);
  });

  it('using --asar overrides other --asar.options', () => {
    const args = parseArgs(['--asar', '--asar.unpack=*.node']);
    expect(args.asar).toBe(true);
    const args2 = parseArgs(['--asar.unpack=*.node', '--asar']);
    expect(args2.asar).toBe(true);
  });

  it('populates opts.osxSign', () => {
    const args = parseArgs(['--osx-sign=true']);
    expect(args.osxSign).toBe(true);
  });

  it('emits a warning if --osx-sign and --osx-sign subproperties are mixed', () => {
    parseArgs(['--osx-sign', '--osx-sign.identity=identity']);
    expect(console.warn).toHaveBeenCalledWith(
      'WARNING: Remove --osx-sign (the bare flag) from the command line, only specify sub-properties (see --help)',
    );
  });

  it('works with --osx-sign as an object', () => {
    const args = parseArgs(['--osx-sign.identity=identity']);
    expect(args.osxSign).toEqual({ identity: 'identity' });
  });

  it('does not accept --osx-notarize=true', () => {
    const args = parseArgs(['--osx-notarize=true']);
    expect(args.osxNotarize).toBeFalsy();
  });

  it('does not accept --osx-notarize as an array', () => {
    const args = parseArgs(['--osx-notarize=1', '--osx-notarize=2']);
    expect(args.osxNotarize).toBeFalsy();
  });

  it('does not accept --osx-notarize without --osx-sign', () => {
    const args = parseArgs(['--osx-notarize.appleId=myid']);
    expect(args.osxNotarize).toBeFalsy();
  });

  it('can disable tmpdir', () => {
    const args = parseArgs(['--tmpdir=false']);
    expect(args.tmpdir).toBe(false);
  });

  it('always resolves --out to be a string', () => {
    const args = parseArgs(['--out=1']);
    expect(args.out).toBe('1');
  });

  it('defaults --out to null if no path is provided', () => {
    const args = parseArgs(['--out']);
    expect(args.out).toBe(null);
  });

  it('accepts --windows-sign=true', () => {
    const args = parseArgs(['--windows-sign=true']);
    expect(args.windowsSign).toBe(true);
  });

  it('emits a warning if --windows-sign and --windows-sign subproperties are mixed', () => {
    parseArgs(['--windows-sign', '--windows-sign.identity=identity']);
    expect(console.warn).toHaveBeenCalledWith(
      'WARNING: Remove --windows-sign (the bare flag) from the command line, only specify sub-properties (see --help)',
    );
  });

  it('works with --windows-sign as an object', () => {
    const args = parseArgs(['--windows-sign.identity=identity']);
    expect(args.windowsSign).toEqual({ identity: 'identity' });
  });

  it('works with --protocol with a corresponding --protocol-name', () => {
    const args = parseArgs(['--protocol=foo', '--protocol-name=Foo']);
    expect(args.protocols).toEqual([{ schemes: ['foo'], name: 'Foo' }]);
  });

  it('does not accept --protocol without a corresponding --protocol-name', () => {
    const args = parseArgs(['--protocol=foo']);
    expect(args.protocols).toBeUndefined();
  });

  it('accepts multiple --protocol/--protocol-name argument pairs', () => {
    const args = parseArgs([
      '--protocol=foo',
      '--protocol-name=Foo',
      '--protocol=bar',
      '--protocol-name=Bar',
    ]);
    expect(args.protocols).toEqual([
      { schemes: ['foo'], name: 'Foo' },
      { schemes: ['bar'], name: 'Bar' },
    ]);
  });
});
