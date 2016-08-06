'use strict'

const config = require('./config.json')
const exec = require('child_process').exec
const series = require('run-series')
const util = require('./util')

// Download all Electron distributions before running tests to avoid timing out due to network
// speed. Most tests run with the config.json version, but we have some tests using 0.37.4, and an
// electron module specific test using 1.3.1.
function preDownloadElectron () {
  const versions = [
    config.version,
    '0.37.4',
    '1.3.1'
  ]
  return versions.map((version) => {
    return (cb) => {
      console.log(`Calling electron-download for ${version} before running tests...`)
      util.downloadAll(version, cb)
    }
  })
}

series(preDownloadElectron().concat([
  function (cb) {
    console.log('Running npm install in fixtures/basic...')
    exec('npm install', {cwd: util.fixtureSubdir('basic')}, cb)
  }, function (cb) {
    console.log('Running npm install in fixtures/basic-renamed-to-electron...')
    exec('npm install', {cwd: util.fixtureSubdir('basic-renamed-to-electron')}, cb)
  }, function (cb) {
    console.log('Running npm install in fixtures/el-0374...')
    exec('npm install', {cwd: util.fixtureSubdir('el-0374')}, cb)
  }
]), function () {
  console.log('Running tests...')
  require('./basic')
  require('./asar')
  require('./cli')
  require('./ignore')
  require('./hooks')
  require('./multitarget')
  require('./win32')

  if (process.platform !== 'win32') {
    // Perform additional tests specific to building for OS X
    require('./darwin')
    require('./mas')
  }
})
