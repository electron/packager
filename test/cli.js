'use strict'

const common = require('../common')
const test = require('tape')

test('CLI argument test: --strict-ssl default', function (t) {
  var args = common.parseCLIArgs([])
  t.true(args['strict-ssl'], 'default for --strict-ssl is true')
  t.end()
})

test('CLI argument test: --download.strictSSL default', function (t) {
  var args = common.parseCLIArgs([])
  t.true(args.download.strictSSL, 'default for --download.strictSSL is true')
  t.end()
})

test('CLI argument test: --asar=true', function (t) {
  var args = common.parseCLIArgs(['--asar=true'])
  t.equal(args.asar, true)
  t.end()
})

test('CLI argument test: using --asar overrides other --asar.options', (t) => {
  let args = common.parseCLIArgs(['--asar', '--asar.unpack=*.node'])
  t.equal(args.asar, true)
  args = common.parseCLIArgs(['--asar.unpack=*.node', '--asar'])
  t.equal(args.asar, true)
  t.end()
})

test('CLI argument test: --osx-sign=true', function (t) {
  var args = common.parseCLIArgs(['--osx-sign=true'])
  t.equal(args['osx-sign'], true)
  t.end()
})

test('CLI argument test: --tmpdir=false', function (t) {
  var args = common.parseCLIArgs(['--tmpdir=false'])
  t.equal(args.tmpdir, false)
  t.end()
})

test('CLI argument test: --deref-symlinks default', function (t) {
  var args = common.parseCLIArgs([])
  t.equal(args['deref-symlinks'], true)
  t.end()
})

test('CLI argument test: --out always resolves to a string', (t) => {
  var args = common.parseCLIArgs(['--out=1'])
  t.equal(args.out, '1')
  t.end()
})

test('CLI argument test: --out without a value is the same as not passing --out', (t) => {
  var args = common.parseCLIArgs(['--out'])
  t.equal(args.out, null)
  t.end()
})
