var asar = require('asar')
var child = require('child_process')
var path = require('path')
var rimraf = require('rimraf')

module.exports = {
  asarApp: function asarApp (finalDir, cb) {
    var src = path.join(finalDir, 'resources', 'app')
    var dest = path.join(finalDir, 'resources', 'app.asar')
    asar.createPackage(src, dest, function (err) {
      if (err) return cb(err)
      rimraf(src, function (err) {
        if (err) return cb(err)
        cb(null, dest)
      })
    })
  },

  prune: function prune (opts, cwd, cb, nextStep) {
    if (opts.prune) {
      child.exec('npm prune --production', { cwd: cwd }, function pruned (err) {
        if (err) return cb(err)
        nextStep()
      })
    } else {
      nextStep()
    }
  }
}
