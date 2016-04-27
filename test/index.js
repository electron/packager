'use strict'

const config = require('./config.json')
const exec = require('child_process').exec
const path = require('path')
const series = require('run-series')
const util = require('./util')

// Download all Electron distributions before running tests to avoid timing out due to network speed.
// Most tests run with the config.json version, but we have a special test (in mac.js) for 0.37.4.
series([
  function (cb) {
    console.log('Calling electron-download before running tests...')
    util.downloadAll(config.version, cb)
  }, function (cb) {
    console.log('Calling electron-download 0.37.4 before running tests...')
    util.downloadAll('0.37.4', cb)
  }, function (cb) {
    console.log('Running npm install in fixtures/basic...')
    exec('npm install', {cwd: path.join(__dirname, 'fixtures', 'basic')}, cb)
  }, function (cb) {
    console.log('Running npm install in fixtures/el-0374...')
    exec('npm install', {cwd: path.join(__dirname, 'fixtures', 'el-0374')}, cb)
  }
], function () {
  console.log('Running tests...')
  require('./basic')
  require('./multitarget')
  require('./win32')

  if (process.platform !== 'win32') {
    // Perform additional tests specific to building for OS X
    require('./darwin')
    require('./mas')
  }
})
