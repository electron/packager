var fs = require('fs')
var path = require('path')
var objectAssign = require('object-assign')

var packager = require('..')
var test = require('tape')
var waterfall = require('run-waterfall')

var config = require('./config.json')
var util = require('./util')

var rcinfo = require('rcinfo')

var baseOpts = {
  name: 'basicTest',
  dir: path.join(__dirname, 'fixtures', 'basic'),
  version: config.version,
  arch: 'x64',
  platform: 'win32'
}

function generateVersionStringTest (metadata_property, extra_opts, expected_value, assertion_msg) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    var appExePath
    var opts = objectAssign({}, baseOpts, extra_opts)

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
        t.equal(info[metadata_property], expected_value, assertion_msg)
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function setFileVersionTest (fileVersion) {
  var opts = {
    'version-string': {
      FileVersion: fileVersion
    }
  }

  return generateVersionStringTest('FileVersion', opts, fileVersion, 'File version should match the value in version-string')
}

function setBuildAndFileVersionTest (buildVersion, fileVersion) {
  var opts = {
    'build-version': buildVersion,
    'version-string': {
      FileVersion: fileVersion
    }
  }

  return generateVersionStringTest('FileVersion', opts, buildVersion, 'File version should match build version')
}

function setProductVersionTest (productVersion) {
  var opts = {
    'version-string': {
      ProductVersion: productVersion
    }
  }

  return generateVersionStringTest('ProductVersion', opts, productVersion, 'Product version should match the value in version-string')
}

function setAppAndProductVersionTest (appVersion, productVersion) {
  var opts = {
    'app-version': appVersion,
    'version-string': {
      ProductVersion: productVersion
    }
  }

  return generateVersionStringTest('ProductVersion', opts, appVersion, 'Product version should match app version')
}

function setLegalCopyrightTest (legalCopyright) {
  var opts = {
    'version-string': {
      LegalCopyright: legalCopyright
    }
  }

  return generateVersionStringTest('LegalCopyright', opts, legalCopyright, 'Legal copyright should match the value in version-string')
}

function setCopyrightOverrideTest (legalCopyright, appCopyright) {
  var opts = {
    'app-copyright': appCopyright,
    'version-string': {
      LegalCopyright: legalCopyright
    }
  }

  return generateVersionStringTest('LegalCopyright', opts, appCopyright, 'Legal copyright should match app copyright')
}

util.setup()
test('win32 file version test', setFileVersionTest('1.2.3.4'))
util.teardown()

util.setup()
test('win32 build version overrides file version test', setBuildAndFileVersionTest('2.3.4.5', '1.2.3.4'))
util.teardown()

util.setup()
test('win32 product version test', setProductVersionTest('4.3.2.1'))
util.teardown()

util.setup()
test('win32 app version overrides product version test', setAppAndProductVersionTest('5.4.3.2', '4.3.2.1'))
util.teardown()

util.setup()
test('win32 legal copyright test', setLegalCopyrightTest('Copyright Foo'))
util.teardown()

util.setup()
test('win32 app copyright overrides LegalCopyright test', setCopyrightOverrideTest('Copyright Foo', 'Copyright Bar'))
util.teardown()
