'use strict'

const cli = require('../src/cli')
const test = require('ava')

test('CLI argument: --electron-version populates opts.electronVersion', t => {
  let args = cli.parseArgs([])
  t.is(args.electronVersion, undefined)
  args = cli.parseArgs(['--electron-version=1.2.3'])
  t.is(args.electronVersion, '1.2.3')
})

test('CLI argument: --download.rejectUnauthorized default', t => {
  const args = cli.parseArgs([])
  t.true(args.download.rejectUnauthorized, 'default for --download.rejectUnauthorized is true')
})

test('CLI argument: --no-download.rejectUnauthorized makes rejectUnauthorized false', t => {
  const args = cli.parseArgs(['--no-download.rejectUnauthorized'])
  t.false(args.download.rejectUnauthorized, 'download.rejectUnauthorized should be false')
})

test('CLI argument: --asar=true', t => {
  const args = cli.parseArgs(['--asar=true'])
  t.true(args.asar)
})

test('CLI argument: using --asar overrides other --asar.options', t => {
  let args = cli.parseArgs(['--asar', '--asar.unpack=*.node'])
  t.true(args.asar)
  args = cli.parseArgs(['--asar.unpack=*.node', '--asar'])
  t.true(args.asar)
})

test('CLI argument: --osx-sign=true', t => {
  const args = cli.parseArgs(['--osx-sign=true'])
  t.true(args.osxSign)
})

test('CLI argument: --osx-notarize=true', t => {
  const args = cli.parseArgs(['--osx-notarize=true'])
  t.falsy(args.osxNotarize, '')
})

test('CLI argument: --osx-notarize is array', t => {
  const args = cli.parseArgs(['--osx-notarize=1', '--osx-notarize=2'])
  t.falsy(args.osxNotarize, '')
})

test('CLI argument: --osx-notarize without --osx-sign', t => {
  const args = cli.parseArgs(['--osx-notarize.appleId=myid'])
  t.falsy(args.osxNotarize, '')
})

test('CLI argument: --tmpdir=false', t => {
  const args = cli.parseArgs(['--tmpdir=false'])
  t.false(args.tmpdir)
})

test('CLI argument: --deref-symlinks default', t => {
  const args = cli.parseArgs([])
  t.true(args.derefSymlinks)
})

test('CLI argument: --out always resolves to a string', t => {
  const args = cli.parseArgs(['--out=1'])
  t.is(args.out, '1')
})

test('CLI argument: --out without a value is the same as not passing --out', t => {
  const args = cli.parseArgs(['--out'])
  t.is(args.out, null)
})

test('CLI argument: --protocol with a corresponding --protocol-name', t => {
  const args = cli.parseArgs(['--protocol=foo', '--protocol-name=Foo'])
  t.deepEqual(args.protocols, [{ schemes: ['foo'], name: 'Foo' }])
})

test('CLI argument: --protocol without a corresponding --protocol-name', t => {
  const args = cli.parseArgs(['--protocol=foo'])
  t.deepEqual(args.protocols, undefined, 'no protocols have been fully defined')
})

test('CLI argument: multiple --protocol/--protocol-name argument pairs', t => {
  const args = cli.parseArgs(['--protocol=foo', '--protocol-name=Foo', '--protocol=bar', '--protocol-name=Bar'])
  t.deepEqual(args.protocols, [{ schemes: ['foo'], name: 'Foo' }, { schemes: ['bar'], name: 'Bar' }])
})
