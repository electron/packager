'use strict'

const config = require('./config.json')
const util = require('./util')

var baseOpts = {
  name: 'basicTest',
  dir: util.fixtureSubdir('basic'),
  version: config.version,
  arch: 'x64',
  platform: 'mas'
}

require('./mac')(baseOpts)
