'use strict'

const { parseArgs } = require('../dist/cli')
const test = require('ava')
const util = require('./_util')

test('CLI argument: --electron-version populates opts.electronVersion', t => {
  let args = parseArgs([])
  t.is(args.electronVersion, undefined)
  args = parseArgs(['--electron-version=1.2.3'])
  t.is(args.electronVersion, '1.2.3')
})

test('CLI argument: --download.rejectUnauthorized default', t => {
  const args = parseArgs([])
  t.true(args.download.rejectUnauthorized, 'default for --download.rejectUnauthorized is true')
})

test('CLI argument: --no-download.rejectUnauthorized makes rejectUnauthorized false', t => {
  const args = parseArgs(['--no-download.rejectUnauthorized'])
  t.false(args.download.rejectUnauthorized, 'download.rejectUnauthorized should be false')
})

test('CLI argument: --asar=true', t => {
  const args = parseArgs(['--asar=true'])
  t.true(args.asar)
})

test('CLI argument: using --asar overrides other --asar.options', t => {
  let args = parseArgs(['--asar', '--asar.unpack=*.node'])
  t.true(args.asar)
  args = parseArgs(['--asar.unpack=*.node', '--asar'])
  t.true(args.asar)
})

test('CLI argument: --osx-sign=true', t => {
  const args = parseArgs(['--osx-sign=true'])
  t.true(args.osxSign)
})

test('CLI argument: --osx-sign and --osx-sign subproperties should not be mixed', t => {
  util.setupConsoleWarnSpy()
  parseArgs(['--osx-sign', '--osx-sign.identity=identity'])
  util.assertWarning(t, 'WARNING: Remove --osx-sign (the bare flag) from the command line, only specify sub-properties (see --help)')
})

test('CLI argument: --osx-sign is object', t => {
  const args = parseArgs([
    '--osx-sign.identity=identity'
  ])
  t.is(args.osxSign.identity, 'identity')
})

test('CLI argument: --osx-notarize=true', t => {
  const args = parseArgs(['--osx-notarize=true'])
  t.falsy(args.osxNotarize, '')
})

test('CLI argument: --osx-notarize is array', t => {
  const args = parseArgs(['--osx-notarize=1', '--osx-notarize=2'])
  t.falsy(args.osxNotarize, '')
})

test('CLI argument: --osx-notarize without --osx-sign', t => {
  const args = parseArgs(['--osx-notarize.appleId=myid'])
  t.falsy(args.osxNotarize, '')
})

test('CLI argument: --tmpdir=false', t => {
  const args = parseArgs(['--tmpdir=false'])
  t.false(args.tmpdir)
})

test('CLI argument: --deref-symlinks default', t => {
  const args = parseArgs([])
  t.true(args.derefSymlinks)
})

test('CLI argument: --out always resolves to a string', t => {
  const args = parseArgs(['--out=1'])
  t.is(args.out, '1')
})

test('CLI argument: --out without a value is the same as not passing --out', t => {
  const args = parseArgs(['--out'])
  t.is(args.out, null)
})

test('CLI argument: --windows-sign=true', t => {
  const args = parseArgs(['--windows-sign=true'])
  t.true(args.windowsSign)
})

test('CLI argument: --windows-sign and --windows-sign subproperties should not be mixed', t => {
  util.setupConsoleWarnSpy()
  parseArgs(['--windows-sign', '--windows-sign.identity=identity'])
  util.assertWarning(t, 'WARNING: Remove --windows-sign (the bare flag) from the command line, only specify sub-properties (see --help)')
})

test('CLI argument: --windows-sign is object', t => {
  const args = parseArgs([
    '--windows-sign.identity=identity'
  ])
  t.is(args.windowsSign.identity, 'identity')
})

test('CLI argument: --protocol with a corresponding --protocol-name', t => {
  const args = parseArgs(['--protocol=foo', '--protocol-name=Foo'])
  t.deepEqual(args.protocols, [{ schemes: ['foo'], name: 'Foo' }])
})

test('CLI argument: --protocol without a corresponding --protocol-name', t => {
  const args = parseArgs(['--protocol=foo'])
  t.is(args.protocols, undefined, 'no protocols have been fully defined')
})

test('CLI argument: multiple --protocol/--protocol-name argument pairs', t => {
  const args = parseArgs(['--protocol=foo', '--protocol-name=Foo', '--protocol=bar', '--protocol-name=Bar'])
  t.deepEqual(args.protocols, [{ schemes: ['foo'], name: 'Foo' }, { schemes: ['bar'], name: 'Bar' }])
})
