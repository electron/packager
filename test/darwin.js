var config = require('./config.json')
var path = require('path')

var baseOpts = {
  name: 'basicTest',
  dir: path.join(__dirname, 'fixtures', 'basic'),
  version: config.version,
  arch: 'x64',
  platform: 'darwin'
}

require('./mac')(baseOpts)
