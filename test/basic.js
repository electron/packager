'use strict'

const common = require('../common')
const config = require('./config.json')
const fs = require('fs-extra')
const packager = require('..')
const path = require('path')
const series = require('run-series')
const test = require('tape')
const util = require('./util')
const waterfall = require('run-waterfall')

function generateNamePath (opts) {
  // Generates path to verify reflects the name given in the options.
  // Returns the Helper.app location on darwin since the top-level .app is already tested for the resources path;
  // returns the executable for other OSes
  if (common.isPlatformMac(opts.platform)) {
    return path.join(`${opts.name}.app`, 'Contents', 'Frameworks', `${opts.name} Helper.app`)
  }

  return opts.name + (opts.platform === 'win32' ? '.exe' : '')
}

function createDefaultsTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')

    var finalPath
    var resourcesPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        t.true(Array.isArray(paths), 'packager call should resolve to an array')
        t.equal(paths.length, 1, 'Single-target run should resolve to a 1-item array')

        finalPath = paths[0]
        t.equal(finalPath, path.join(util.getWorkCwd(), common.generateFinalBasename(opts)),
          'Path should follow the expected format and be in the cwd')
        fs.stat(finalPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected output directory should exist')
        resourcesPath = path.join(finalPath, util.generateResourcesPath(opts))
        fs.stat(path.join(finalPath, generateNamePath(opts)), cb)
      }, function (stats, cb) {
        if (common.isPlatformMac(opts.platform)) {
          t.true(stats.isDirectory(), 'The Helper.app should reflect opts.name')
        } else {
          t.true(stats.isFile(), 'The executable should reflect opts.name')
        }
        fs.stat(resourcesPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The output directory should contain the expected resources subdirectory')
        fs.stat(path.join(resourcesPath, 'app', 'node_modules', 'run-waterfall'), cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The output directory should contain devDependencies by default (no prune)')
        util.areFilesEqual(path.join(opts.dir, 'main.js'), path.join(resourcesPath, 'app', 'main.js'), cb)
      }, function (equal, cb) {
        t.true(equal, 'File under packaged app directory should match source file')
        util.areFilesEqual(path.join(opts.dir, 'ignore', 'this.txt'),
          path.join(resourcesPath, 'app', 'ignore', 'this.txt'),
          cb)
      }, function (equal, cb) {
        t.true(equal,
          'File under subdirectory of packaged app directory should match source file and not be ignored by default')
        fs.exists(path.join(resourcesPath, 'default_app'), function (exists) {
          t.false(exists, 'The output directory should not contain the Electron default app directory')
          cb()
        })
      }, function (cb) {
        fs.exists(path.join(resourcesPath, 'default_app.asar'), function (exists) {
          t.false(exists, 'The output directory should not contain the Electron default app asar file')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createDefaultAppAsarTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'el0374Test'
    opts.dir = path.join(__dirname, 'fixtures', 'el-0374')
    opts.version = '0.37.4'

    var resourcesPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        resourcesPath = path.join(paths[0], util.generateResourcesPath(opts))
        fs.exists(path.join(resourcesPath, 'default_app.asar'), function (exists) {
          t.false(exists, 'The output directory should not contain the Electron default_app.asar file')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createOutTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')
    opts.out = 'dist'

    var finalPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        finalPath = paths[0]
        t.equal(finalPath, path.join('dist', common.generateFinalBasename(opts)),
          'Path should follow the expected format and be under the folder specifed in `out`')
        fs.stat(finalPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected output directory should exist')
        fs.stat(path.join(finalPath, util.generateResourcesPath(opts)), cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The output directory should contain the expected resources subdirectory')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createAsarTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')
    opts.asar = true
    opts['asar-unpack'] = '*.pac'
    opts['asar-unpack-dir'] = 'dir_to_unpack'
    var finalPath
    var resourcesPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        finalPath = paths[0]
        fs.stat(finalPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected output directory should exist')
        resourcesPath = path.join(finalPath, util.generateResourcesPath(opts))
        fs.stat(resourcesPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The output directory should contain the expected resources subdirectory')
        fs.stat(path.join(resourcesPath, 'app.asar'), cb)
      }, function (stats, cb) {
        t.true(stats.isFile(), 'app.asar should exist under the resources subdirectory when opts.asar is true')
        fs.exists(path.join(resourcesPath, 'app'), function (exists) {
          t.false(exists, 'app subdirectory should NOT exist when app.asar is built')
        })
        fs.stat(path.join(resourcesPath, 'app.asar.unpacked'), cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'app.asar.unpacked should exist under the resources subdirectory when opts.asar_unpack is set some expression')
        fs.stat(path.join(resourcesPath, 'app.asar.unpacked', 'dir_to_unpack'), cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'dir_to_unpack should exist under app.asar.unpacked subdirectory when opts.asar-unpack-dir is set dir_to_unpack')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createPruneTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')
    opts.prune = true

    var finalPath
    var resourcesPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        finalPath = paths[0]
        fs.stat(finalPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected output directory should exist')
        resourcesPath = path.join(finalPath, util.generateResourcesPath(opts))
        fs.stat(resourcesPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The output directory should contain the expected resources subdirectory')
        fs.stat(path.join(resourcesPath, 'app', 'node_modules', 'run-series'), cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'npm dependency should exist under app/node_modules')
        fs.exists(path.join(resourcesPath, 'app', 'node_modules', 'run-waterfall'), function (exists) {
          t.false(exists, 'npm devDependency should NOT exist under app/node_modules')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createIgnoreTest (opts, ignorePattern, ignoredFile) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')
    opts.ignore = ignorePattern

    var appPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        appPath = path.join(paths[0], util.generateResourcesPath(opts), 'app')
        fs.stat(path.join(appPath, 'package.json'), cb)
      }, function (stats, cb) {
        t.true(stats.isFile(), 'The expected output directory should exist and contain files')
        fs.exists(path.join(appPath, ignoredFile), function (exists) {
          t.false(exists, 'Ignored file should not exist in output app directory')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createOverwriteTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout * 2) // Multiplied since this test packages the application twice

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')

    var finalPath
    var testPath

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        finalPath = paths[0]
        fs.stat(finalPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected output directory should exist')
        // Create a dummy file to detect whether the output directory is replaced in subsequent runs
        testPath = path.join(finalPath, 'test.txt')
        fs.writeFile(testPath, 'test', cb)
      }, function (cb) {
        // Run again, defaulting to overwrite false
        packager(opts, cb)
      }, function (paths, cb) {
        fs.stat(testPath, cb)
      }, function (stats, cb) {
        t.true(stats.isFile(), 'The existing output directory should exist as before (skipped by default)')
        // Run a third time, explicitly setting overwrite to true
        opts.overwrite = true
        packager(opts, cb)
      }, function (paths, cb) {
        fs.exists(testPath, function (exists) {
          t.false(exists, 'The output directory should be regenerated when overwrite is true')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createInferTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    // Don't specify name or version
    delete opts.version
    opts.dir = path.join(__dirname, 'fixtures', 'basic')

    var finalPath
    var packageJSON

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        finalPath = paths[0]
        fs.stat(finalPath, cb)
      }, function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected output directory should exist')
        fs.readFile(path.join(opts.dir, 'package.json'), cb)
      }, function (pkg, cb) {
        packageJSON = JSON.parse(pkg)
        // Set opts name to use generateNamePath
        opts.name = packageJSON.productName
        fs.stat(path.join(finalPath, generateNamePath(opts)), cb)
      }, function (stats, cb) {
        if (common.isPlatformMac(opts.platform)) {
          t.true(stats.isDirectory(), 'The Helper.app should reflect productName')
        } else {
          t.true(stats.isFile(), 'The executable should reflect productName')
        }
        fs.readFile(path.join(finalPath, 'version'), cb)
      }, function (version, cb) {
        t.equal(`v${packageJSON.devDependencies['electron-prebuilt']}`, version.toString(), 'The version should be inferred from installed electron-prebuilt version')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createTmpdirTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')
    opts.out = 'dist'
    opts.tmpdir = path.join(util.getWorkCwd(), 'tmp')

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        fs.stat(path.join(opts.tmpdir, 'electron-packager'), cb)
      },
      function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected temp directory should exist')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createDisableTmpdirUsingTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'
    opts.dir = path.join(__dirname, 'fixtures', 'basic')
    opts.out = 'dist'
    opts.tmpdir = false

    waterfall([
      function (cb) {
        packager(opts, cb)
      }, function (paths, cb) {
        fs.stat(paths[0], cb)
      },
      function (stats, cb) {
        t.true(stats.isDirectory(), 'The expected out directory should exist')
        cb()
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createIgnoreOutDirTest (opts, distPath) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'

    var appDir = util.getWorkCwd()
    opts.dir = appDir
    // we don't use path.join here to avoid normalizing
    var outDir = opts.dir + path.sep + distPath
    opts.out = outDir

    series([
      function (cb) {
        fs.copy(path.join(__dirname, 'fixtures', 'basic'), appDir, {dereference: true, stopOnErr: true, filter: function (file) {
          return path.basename(file) !== 'node_modules'
        }}, cb)
      },
      function (cb) {
        // create out dir before packager (real world issue - when second run includes uningnored out dir)
        fs.mkdirp(outDir, cb)
      },
      function (cb) {
        // create file to ensure that directory will be not ignored because empty
        fs.open(path.join(outDir, 'ignoreMe'), 'w', function (err, fd) {
          if (err) return cb(err)
          fs.close(fd, cb)
        })
      },
      function (cb) {
        packager(opts, cb)
      },
      function (cb) {
        fs.exists(path.join(outDir, common.generateFinalBasename(opts), util.generateResourcesPath(opts), 'app', path.basename(outDir)), function (exists) {
          t.false(exists, 'Out dir must not exist in output app directory')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

function createIgnoreImplicitOutDirTest (opts) {
  return function (t) {
    t.timeoutAfter(config.timeout)

    opts.name = 'basicTest'

    var appDir = util.getWorkCwd()
    opts.dir = appDir
    var outDir = opts.dir

    var testFilename = 'ignoreMe'
    var previousPackedResultDir

    series([
      function (cb) {
        fs.copy(path.join(__dirname, 'fixtures', 'basic'), appDir, {dereference: true, stopOnErr: true, filter: function (file) {
          return path.basename(file) !== 'node_modules'
        }}, cb)
      },
      function (cb) {
        previousPackedResultDir = path.join(outDir, `${opts.name}-linux-ia32`)
        fs.mkdirp(previousPackedResultDir, cb)
      },
      function (cb) {
        // create file to ensure that directory will be not ignored because empty
        fs.open(path.join(previousPackedResultDir, testFilename), 'w', function (err, fd) {
          if (err) return cb(err)
          fs.close(fd, cb)
        })
      },
      function (cb) {
        packager(opts, cb)
      },
      function (cb) {
        fs.exists(path.join(outDir, common.generateFinalBasename(opts), util.generateResourcesPath(opts), 'app', testFilename), function (exists) {
          t.false(exists, 'Out dir must not exist in output app directory')
          cb()
        })
      }
    ], function (err) {
      t.end(err)
    })
  }
}

test('download argument test: download.cache overwrites cache', function (t) {
  var opts = {
    cache: 'should not exist',
    download: {
      cache: 'should exist'
    },
    version: '0.36.0'
  }

  var downloadOpts = common.createDownloadOpts(opts, 'linux', 'x64')
  t.same(downloadOpts, {arch: 'x64', platform: 'linux', version: '0.36.0', cache: opts.download.cache, strictSSL: undefined})
  t.end()
})

test('download argument test: download.strictSSL overwrites strict-ssl', function (t) {
  var opts = {
    download: {
      strictSSL: false
    },
    'strict-ssl': true,
    version: '0.36.0'
  }

  var downloadOpts = common.createDownloadOpts(opts, 'linux', 'x64')
  t.same(downloadOpts, {arch: 'x64', platform: 'linux', version: '0.36.0', cache: undefined, strictSSL: opts.download.strictSSL})
  t.end()
})

test('download argument test: download.{arch,platform,version} does not overwrite {arch,platform,version}', function (t) {
  var opts = {
    download: {
      arch: 'ia32',
      platform: 'win32',
      version: '0.30.0'
    },
    version: '0.36.0'
  }

  var downloadOpts = common.createDownloadOpts(opts, 'linux', 'x64')
  t.same(downloadOpts, {arch: 'x64', platform: 'linux', version: '0.36.0', cache: undefined, strictSSL: undefined})
  t.end()
})

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

test('CLI argument test: --tmpdir=false', function (t) {
  var args = common.parseCLIArgs(['--tmpdir=false'])
  t.equal(args.tmpdir, false)
  t.end()
})

test('CLI argument test: --osx-sign=true', function (t) {
  var args = common.parseCLIArgs(['--osx-sign=true'])
  t.equal(args['osx-sign'], true)
  t.end()
})

util.testSinglePlatform('infer test', createInferTest)
util.testSinglePlatform('defaults test', createDefaultsTest)
util.testSinglePlatform('default_app.asar removal test', createDefaultAppAsarTest)
util.testSinglePlatform('out test', createOutTest)
util.testSinglePlatform('asar test', createAsarTest)
util.testSinglePlatform('prune test', createPruneTest)
util.testSinglePlatform('ignore test: string in array', createIgnoreTest, ['ignorethis'], 'ignorethis.txt')
util.testSinglePlatform('ignore test: string', createIgnoreTest, 'ignorethis', 'ignorethis.txt')
util.testSinglePlatform('ignore test: RegExp', createIgnoreTest, /ignorethis/, 'ignorethis.txt')
util.testSinglePlatform('ignore test: Function', createIgnoreTest, function (file) { return file.match(/ignorethis/) }, 'ignorethis.txt')
util.testSinglePlatform('ignore test: string with slash', createIgnoreTest, 'ignore/this',
  path.join('ignore', 'this.txt'))
util.testSinglePlatform('ignore test: only match subfolder of app', createIgnoreTest, 'electron-packager',
  path.join('electron-packager', 'readme.txt'))
util.testSinglePlatform('overwrite test', createOverwriteTest)
util.testSinglePlatform('tmpdir test', createTmpdirTest)
util.testSinglePlatform('tmpdir test', createDisableTmpdirUsingTest)
util.testSinglePlatform('ignore out dir test', createIgnoreOutDirTest, 'ignoredOutDir')
util.testSinglePlatform('ignore out dir test: unnormalized path', createIgnoreOutDirTest, './ignoredOutDir')
util.testSinglePlatform('ignore out dir test: unnormalized path', createIgnoreImplicitOutDirTest)

util.setup()
test('fails with invalid arch', function (t) {
  var opts = {
    name: 'el0374Test',
    dir: path.join(__dirname, 'fixtures', 'el-0374'),
    version: '0.37.4',
    arch: 'z80',
    platform: 'linux'
  }
  packager(opts, function (err, paths) {
    t.equal(undefined, paths, 'no paths returned')
    t.ok(err, 'error thrown')
    t.end()
  })
})
util.teardown()

util.setup()
test('fails with invalid platform', function (t) {
  var opts = {
    name: 'el0374Test',
    dir: path.join(__dirname, 'fixtures', 'el-0374'),
    version: '0.37.4',
    arch: 'ia32',
    platform: 'dos'
  }
  packager(opts, function (err, paths) {
    t.equal(undefined, paths, 'no paths returned')
    t.ok(err, 'error thrown')
    t.end()
  })
})
util.teardown()

util.setup()
test('fails with invalid version', function (t) {
  var opts = {
    name: 'invalidElectronTest',
    dir: path.join(__dirname, 'fixtures', 'el-0374'),
    version: '0.0.1',
    arch: 'x64',
    platform: 'linux'
  }
  packager(opts, function (err, paths) {
    t.equal(undefined, paths, 'no paths returned')
    t.ok(err, 'error thrown')
    t.end()
  })
})
util.teardown()
