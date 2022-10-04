'use strict'

module.exports = function (nodeVersion) {
  var nodeVersionInfo = nodeVersion.split('.').map(function (n) { return Number(n) })
  var nodeVersionMajor = nodeVersionInfo[0]
  return nodeVersionMajor >= 4
}
