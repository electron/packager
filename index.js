var path = require('path')
var os = require('os')

var download = require('electron-download')
var extract = require('extract-zip')
var mkdirp = require('mkdirp')
var rimraf = require('rimraf')

var mac = require('./mac.js')
var linux = require('./linux.js')
var win32 = require('./win32.js')

module.exports = function packager (opts, cb) {
  var packager
  var platform = opts.platform
  var arch = opts.arch
  var version = opts.version

  if (!platform || !arch || !version) cb(new Error('Must specify platform, arch and version'))

  switch (arch) {
    case 'ia32': break
    case 'x64': break
    default: return cb(new Error('Unsupported arch. Must be either ia32 or x64'))
  }

  switch (platform) {
    case 'darwin': packager = mac; break
    case 'linux': packager = linux; break
    case 'win32': packager = win32; break
    default: return cb(new Error('Unsupported platform. Must be either darwin, linux, or win32'))
  }

  // Ignore this and related modules by default
  var defaultIgnores = [
    '(^|/)\.git$',
    '^node_modules/electron-prebuilt$',
    '^node_modules/electron-packager$',
    '^node_modules/electron-rebuild$'
  ]
  if (opts.ignore && !Array.isArray(opts.ignore)) opts.ignore = [opts.ignore]
  opts.ignore = (opts.ignore) ? opts.ignore.concat(defaultIgnores) : defaultIgnores

  opts.ignoreFilter = function (file) {
    // strip the fromDir from the file path
    file = file.substring(opts.dir.length + 1)

    // convert slashes so unix-format ignores work
    file = file.replace(/\\/g, '/')

    var ignore = opts.ignore || []
    if (!Array.isArray(ignore)) ignore = [ignore]
    for (var i = 0; i < ignore.length; i++) {
      if (file.match(ignore[i])) {
        console.log('Ignoring:', file)
        return false
      }
    }
    return true
  }

  download({
    platform: platform,
    arch: arch,
    version: version
  }, function (err, zipPath) {
    if (err) return cb(err)
    console.error('Packaging app for platform', platform + ' ' + arch, 'using electron v' + version)
    // extract zip into tmp so that packager can use it as a template
    var tmpDir = path.join(os.tmpdir(), 'electron-packager-' + platform + '-template')
    rimraf(tmpDir, function (err) {
      if (err) {} // ignore err
      mkdirp(tmpDir, function (err) {
        if (err) return cb(err)
        extract(zipPath, {dir: tmpDir}, function (err) {
          if (err) return cb(err)
          packager.createApp(opts, tmpDir, cb)
        })
      })
    })
  })
}
