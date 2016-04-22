var config = require('./config.json')
var fs = require('fs')
var packager = require('..')
var path = require('path')
var rcinfo = require('rcinfo')
var test = require('tape')
var util = require('./util')
var waterfall = require('run-waterfall')

var baseOpts = {
  name: 'basicTest',
  dir: path.join(__dirname, 'fixtures', 'basic'),
  version: config.version,
  arch: 'x64',
  platform: 'win32'
}

function generateVersionStringTest (metadata_properties, extra_opts, expected_values, assertion_msgs) {
  return function (t) {
    t.timeoutAfter(process.platform === 'darwin' ? config.macExecTimeout : config.timeout)

    var appExePath
    var opts = Object.assign({}, baseOpts, extra_opts)

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        appExePath = path.join(paths[0], opts.name + '.exe')
        fs.stat(appExePath, cb)
      }, function (stats, cb) {
        t.true(stats.isFile(), 'The expected EXE file should exist')
        cb()
      }, function (cb) {
        rcinfo(appExePath, cb)
      }, function (info, cb) {
        metadata_properties = [].concat(metadata_properties)
        expected_values = [].concat(expected_values)
        assertion_msgs = [].concat(assertion_msgs)
        metadata_properties.forEach(function (property, i) {
          var value = expected_values[i]
          var msg = assertion_msgs[i]
          t.equal(info[property], value, msg)
        })
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function setFileVersionTest (buildVersion) {
  var opts = {
    'build-version': buildVersion
  }

  return generateVersionStringTest('FileVersion', opts, buildVersion, 'File version should match build version')
}

function setProductVersionTest (appVersion) {
  var opts = {
    'app-version': appVersion
  }

  return generateVersionStringTest('ProductVersion', opts, appVersion, 'Product version should match app version')
}

function setCopyrightTest (appCopyright) {
  var opts = {
    'app-copyright': appCopyright
  }

  return generateVersionStringTest('LegalCopyright', opts, appCopyright, 'Legal copyright should match app copyright')
}

function setCopyrightAndCompanyNameTest (appCopyright, companyName) {
  var opts = {
    'app-copyright': appCopyright,
    'version-string': {
      CompanyName: companyName
    }
  }

  return generateVersionStringTest(['LegalCopyright', 'CompanyName'],
                                   opts,
                                   [appCopyright, companyName],
                                   ['Legal copyright should match app copyright',
                                    'Company name should match version-string value'])
}

util.setup()
test('win32 build version sets FileVersion test', setFileVersionTest('2.3.4.5'))
util.teardown()

util.setup()
test('win32 app version sets ProductVersion test', setProductVersionTest('5.4.3.2'))
util.teardown()

util.setup()
test('win32 app copyright sets LegalCopyright test', setCopyrightTest('Copyright Bar'))
util.teardown()

util.setup()
test('win32 set LegalCopyright and CompanyName test', setCopyrightAndCompanyNameTest('Copyright Bar', 'MyCompany LLC'))
util.teardown()
