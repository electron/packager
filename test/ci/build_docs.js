#!/usr/bin/env node
'use strict'

const { Application } = require('typedoc')

/** @type import('typedoc').TypeDocOptions */
const config = {
  excludeExternals: true,
  excludePrivate: true,
  excludeProtected: true,
  entryPoints: ['src/index.ts']
}

const replaceRef = /^refs\/(head|tag)s\//

function gitRevisionFromGitHubRef () {
  const githubRef = process.env.GITHUB_REF
  if (githubRef) {
    return githubRef.replace(replaceRef, '')
  }
}

const gitRevision = process.argv[2] || gitRevisionFromGitHubRef()
if (gitRevision) {
  if (/^[0-9a-f]+$/i.test(gitRevision)) {
    config.gitRevision = gitRevision
  } else if (gitRevision.startsWith('v')) {
    config.includeVersion = true
  }
}

Application.bootstrap(config).then(async app => {
  const project = await app.convert()
  if (project) {
    await app.generateDocs(project, 'typedoc')
  } else {
    console.error('Could not generate API documentation from TypeScript definition!')
    process.exit(1)
  }
})

