#!/usr/bin/env node

'use strict'

const packageJSON = require('../package.json')
const semver = require('semver')
if (!semver.satisfies(process.versions.node, packageJSON.engines.node)) {
  console.error('CANNOT RUN WITH NODE ' + process.versions.node)
  console.error('Electron Packager requires Node ' + packageJSON.engines.node + '.')
  process.exit(1)
}

const cli = require('../dist/cli')
cli.run(process.argv.slice(2))
