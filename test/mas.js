'use strict'

const config = require('./config.json')
const packager = require('..')
const util = require('./util')

const masOpts = {
  name: 'basicTest',
  dir: util.fixtureSubdir('basic'),
  electronVersion: config.version,
  arch: 'x64',
  platform: 'mas'
}

util.packagerTest('warn if building for mas and not signing', t => {
  const warningLog = console.warn
  let output = ''
  console.warn = message => { output += message }

  const finalize = err => {
    console.warn = warningLog
    t.end(err)
  }

  packager(masOpts)
    .then(() => {
      t.ok(output.match(/signing is required for mas builds/), 'the correct warning is emitted')
      return null
    }).then(finalize)
    .catch(finalize)
})
