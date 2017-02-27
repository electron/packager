'use strict'

const debug = require('debug')('electron-packager')
const getPackageInfo = require('get-package-info')
const path = require('path')
const resolve = require('resolve')

function isMissingRequiredProperty (props) {
  var requiredProps = props.filter(
    (prop) => prop === 'productName' || prop === 'dependencies.electron'
  )
  return requiredProps.length !== 0
}

function errorMessageForProperty (prop) {
  let hash, propDescription
  switch (prop) {
    case 'productName':
      hash = 'name'
      propDescription = 'application name'
      break
    case 'dependencies.electron':
      hash = 'version'
      propDescription = 'Electron version'
      break
    default:
      hash = ''
      propDescription = '[Unknown Property]'
  }

  return `Unable to determine ${propDescription}. Please specify an ${propDescription}\n\n` +
    'For more information, please see\n' +
    `https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#${hash}\n`
}

function getVersion (opts, packageName, src, cb) {
  resolve(packageName, {
    basedir: path.dirname(src)
  }, (err, res, pkg) => {
    if (err) return cb(err)
    debug(`Inferring target Electron version from ${packageName} in ${src}`)
    opts.electronVersion = pkg.version
    return cb(null)
  })
}

module.exports = function getMetadataFromPackageJSON (opts, dir, cb) {
  let props = []
  if (!opts.name) props.push(['productName', 'name'])
  if (!opts.appVersion) props.push('version')
  if (!opts.electronVersion) {
    props.push([
      'dependencies.electron',
      'devDependencies.electron',
      'dependencies.electron-prebuilt',
      'devDependencies.electron-prebuilt'
    ])
  }

  // Name and version provided, no need to infer
  if (props.length === 0) return cb(null)

  // Search package.json files to infer name and version from
  getPackageInfo(props, dir, (err, result) => {
    if (err && err.missingProps) {
      let missingProps = err.missingProps.map(prop => {
        return Array.isArray(prop) ? prop[0] : prop
      })

      if (isMissingRequiredProperty(missingProps)) {
        let messages = missingProps.map(errorMessageForProperty)

        debug(err.message)
        err.message = messages.join('\n') + '\n'
        return cb(err)
      } else {
        // Missing props not required, can continue w/ partial result
        result = err.result
      }
    } else if (err) {
      return cb(err)
    }

    if (result.values.productName) {
      debug(`Inferring application name from ${result.source.productName.prop} in ${result.source.productName.src}`)
      opts.name = result.values.productName
    }

    if (result.values.version) {
      debug(`Inferring appVersion from version in ${result.source.version.src}`)
      opts.appVersion = result.values.version
    }

    if (result.values['dependencies.electron']) {
      let prop = result.source['dependencies.electron'].prop.split('.')[1]
      let src = result.source['dependencies.electron'].src
      return getVersion(opts, prop, src, cb)
    } else {
      return cb(null)
    }
  })
}
