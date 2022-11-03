'use strict'

const asar = require('@electron/asar')
const crypto = require('crypto')
const debug = require('debug')('electron-packager')
const fs = require('fs-extra')
const path = require('path')

const common = require('./common')
const copyFilter = require('./copy-filter')
const hooks = require('./hooks')

class App {
  constructor (opts, templatePath) {
    this.opts = opts
    this.templatePath = templatePath
    this.asarOptions = common.createAsarOpts(opts)

    if (this.opts.prune === undefined) {
      this.opts.prune = true
    }
  }

  /**
   * Resource directory path before renaming.
   */
  get originalResourcesDir () {
    return this.resourcesDir
  }

  /**
   * Resource directory path after renaming.
   */
  get resourcesDir () {
    return path.join(this.stagingPath, 'resources')
  }

  get originalResourcesAppDir () {
    return path.join(this.originalResourcesDir, 'app')
  }

  get electronBinaryDir () {
    return this.stagingPath
  }

  get originalElectronName () {
    /* istanbul ignore next */
    throw new Error('Child classes must implement this')
  }

  get newElectronName () {
    /* istanbul ignore next */
    throw new Error('Child classes must implement this')
  }

  get executableName () {
    return this.opts.executableName || this.opts.name
  }

  get stagingPath () {
    if (this.opts.tmpdir === false) {
      return common.generateFinalPath(this.opts)
    } else {
      if (!this.cachedStagingPath) {
        const parentDir = path.join(
          common.baseTempDir(this.opts),
          `${this.opts.platform}-${this.opts.arch}`
        )
        fs.mkdirpSync(parentDir)
        this.cachedStagingPath = fs.mkdtempSync(path.join(parentDir, `${common.generateFinalBasename(this.opts)}-`))
      }
      return this.cachedStagingPath
    }
  }

  get appAsarPath () {
    return path.join(this.originalResourcesDir, 'app.asar')
  }

  get commonHookArgs () {
    return [
      this.opts.electronVersion,
      this.opts.platform,
      this.opts.arch
    ]
  }

  get hookArgsWithOriginalResourcesAppDir () {
    return [
      this.originalResourcesAppDir,
      ...this.commonHookArgs
    ]
  }

  async relativeRename (basePath, oldName, newName) {
    debug(`Renaming ${oldName} to ${newName} in ${basePath}`)
    await fs.rename(path.join(basePath, oldName), path.join(basePath, newName))
  }

  async renameElectron () {
    return this.relativeRename(this.electronBinaryDir, this.originalElectronName, this.newElectronName)
  }

  /**
   * Performs the following initial operations for an app:
   * * Creates temporary directory
   * * Remove default_app (which is either a folder or an asar file)
   * * If a prebuilt asar is specified:
   *   * Copies asar into temporary directory as app.asar
   * * Otherwise:
   *   * Copies template into temporary directory
   *   * Copies user's app into temporary directory
   *   * Prunes non-production node_modules (if opts.prune is either truthy or undefined)
   *   * Creates an asar (if opts.asar is set)
   *
   * Prune and asar are performed before platform-specific logic, primarily so that
   * this.originalResourcesAppDir is predictable (e.g. before .app is renamed for Mac)
   */
  async initialize () {
    debug(`Initializing app in ${this.stagingPath} from ${this.templatePath} template`)

    await fs.move(this.templatePath, this.stagingPath, { clobber: true })
    await this.removeDefaultApp()
    if (this.opts.prebuiltAsar) {
      await this.copyPrebuiltAsar()
    } else {
      await this.buildApp()
    }

    await hooks.promisifyHooks(this.opts.afterInitialize, this.hookArgsWithOriginalResourcesAppDir)
  }

  async buildApp () {
    await this.copyTemplate()
    await common.validateElectronApp(this.opts.dir, this.originalResourcesAppDir)
    await this.asarApp()
  }

  async copyTemplate () {
    await hooks.promisifyHooks(this.opts.beforeCopy, this.hookArgsWithOriginalResourcesAppDir)

    await fs.copy(this.opts.dir, this.originalResourcesAppDir, {
      filter: copyFilter.userPathFilter(this.opts),
      dereference: this.opts.derefSymlinks
    })
    await hooks.promisifyHooks(this.opts.afterCopy, this.hookArgsWithOriginalResourcesAppDir)
    if (this.opts.prune) {
      await hooks.promisifyHooks(this.opts.afterPrune, this.hookArgsWithOriginalResourcesAppDir)
    }
  }

  async removeDefaultApp () {
    await Promise.all(['default_app', 'default_app.asar'].map(async basename => fs.remove(path.join(this.originalResourcesDir, basename))))
  }

  /**
   * Forces an icon filename to a given extension and returns the normalized filename,
   * if it exists.  Otherwise, returns null.
   *
   * This error path is used by win32 if no icon is specified.
   */
  async normalizeIconExtension (targetExt) {
    if (!this.opts.icon) throw new Error('No filename specified to normalizeIconExtension')

    let iconFilename = this.opts.icon
    const ext = path.extname(iconFilename)
    if (ext !== targetExt) {
      iconFilename = path.join(path.dirname(iconFilename), path.basename(iconFilename, ext) + targetExt)
    }

    if (await fs.pathExists(iconFilename)) {
      return iconFilename
    } else {
      /* istanbul ignore next */
      common.warning(`Could not find icon "${iconFilename}", not updating app icon`, this.opts.quiet)
    }
  }

  prebuiltAsarWarning (option, triggerWarning) {
    if (triggerWarning) {
      common.warning(`prebuiltAsar and ${option} are incompatible, ignoring the ${option} option`, this.opts.quiet)
    }
  }

  async copyPrebuiltAsar () {
    if (this.asarOptions) {
      common.warning('prebuiltAsar has been specified, all asar options will be ignored', this.opts.quiet)
    }

    for (const hookName of ['beforeCopy', 'afterCopy', 'afterPrune']) {
      if (this.opts[hookName]) {
        throw new Error(`${hookName} is incompatible with prebuiltAsar`)
      }
    }

    this.prebuiltAsarWarning('ignore', this.opts.originalIgnore)
    this.prebuiltAsarWarning('prune', !this.opts.prune)
    this.prebuiltAsarWarning('derefSymlinks', this.opts.derefSymlinks !== undefined)

    const src = path.resolve(this.opts.prebuiltAsar)

    const stat = await fs.stat(src)
    if (!stat.isFile()) {
      throw new Error(`${src} specified in prebuiltAsar must be an asar file.`)
    }

    debug(`Copying asar: ${src} to ${this.appAsarPath}`)
    await fs.copy(src, this.appAsarPath, { overwrite: false, errorOnExist: true })
  }

  appRelativePath (p) {
    return path.relative(this.stagingPath, p)
  }

  async asarApp () {
    if (!this.asarOptions) {
      return Promise.resolve()
    }

    debug(`Running asar with the options ${JSON.stringify(this.asarOptions)}`)

    await hooks.promisifyHooks(this.opts.beforeAsar, this.hookArgsWithOriginalResourcesAppDir)

    await asar.createPackageWithOptions(this.originalResourcesAppDir, this.appAsarPath, this.asarOptions)
    const { headerString } = asar.getRawHeader(this.appAsarPath)
    this.asarIntegrity = {
      [this.appRelativePath(this.appAsarPath)]: {
        algorithm: 'SHA256',
        hash: crypto.createHash('SHA256').update(headerString).digest('hex')
      }
    }
    await fs.remove(this.originalResourcesAppDir)

    await hooks.promisifyHooks(this.opts.afterAsar, this.hookArgsWithOriginalResourcesAppDir)
  }

  async copyExtraResources () {
    if (!this.opts.extraResource) return Promise.resolve()

    const extraResources = common.ensureArray(this.opts.extraResource)

    const hookArgs = [
      this.stagingPath,
      ...this.commonHookArgs
    ]

    await hooks.promisifyHooks(this.opts.beforeCopyExtraResources, hookArgs)

    await Promise.all(extraResources.map(
      resource => fs.copy(resource, path.resolve(this.stagingPath, this.resourcesDir, path.basename(resource)))
    ))

    await hooks.promisifyHooks(this.opts.afterCopyExtraResources, hookArgs)
  }

  async move () {
    const finalPath = common.generateFinalPath(this.opts)

    if (this.opts.tmpdir !== false) {
      debug(`Moving ${this.stagingPath} to ${finalPath}`)
      await fs.move(this.stagingPath, finalPath)
    }

    if (this.opts.afterComplete) {
      const hookArgs = [
        finalPath,
        ...this.commonHookArgs
      ]

      await hooks.promisifyHooks(this.opts.afterComplete, hookArgs)
    }

    return finalPath
  }
}

module.exports = App
