var path = require('path')

var config = require('./config.json')

var baseOpts = {
  name: 'basicTest',
  dir: path.join(__dirname, 'fixtures', 'basic'),
  version: config.version,
  arch: 'x64',
  platform: 'mas'
}

require('./mac')(baseOpts)
