'use strict'

require('./_util')

require('./basic')
require('./asar')
require('./cli')
require('./ignore')
require('./infer')
require('./hooks')
require('./prune')
require('./targets')
require('./win32')

if (process.platform !== 'win32') {
  // Perform additional tests specific to building for macOS
  require('./darwin')
  require('./mas')
}
