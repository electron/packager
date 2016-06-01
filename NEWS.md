# Changes by Version

## Unreleased


## [7.0.3] - 2016-05-31

### Changed

* [contributors] Code contributions need to be validated in "strict" mode (#342, #351)

### Fixed

* CLI output truncated when using Node 6 (and possibly earlier) (#381)

## [7.0.2] - 2016-05-18

### Fixed

* The default `.git` ignore only ignores that directory (#344)
* Specifying the `download.strictSSL` CLI parameter no longer triggers a deprecation warning for
  `strict-ssl` (#349)

## [7.0.1] - 2016-04-21

### Fixed

* Not specifying `strict-ssl` CLI parameter no longer triggers a deprecation warning (#335)

## [7.0.0] - 2016-04-17

### Added

* Add `download` parameter (#320)

### Changed

* **Dropped support for running on Node &lt; 4.0.** (#319)

### Fixed

* `strict-ssl` (and by extension, `download.strictSSL`) defaults to `true`, as documented (#320)

### Deprecated

* `cache` is deprecated in favor of `download.cache` (#320)
* `strict-ssl` is deprecated in favor of `download.strictSSL` (#320)

### Removed

* [win32] `version-string.FileVersion` and `version-string.ProductVersion` are replaced by
  favor of `app-version` and `build-version`, respectively (#327)
* [win32] `version-string.LegalCopyright` is replaced by `app-copyright` (#327)

## [6.0.2] - 2016-04-09

### Changed

* [win32] `rcedit` dependency updated to 0.5.x. **The DLL mentioned in the 6.0.1 release notes
  is no longer required.**

## [6.0.1] - 2016-04-08

### Changed

* [win32] `rcedit` dependency updated to 0.4.x. **A new DLL is required to run the new version
  of rcedit, please see [the documentation](https://github.com/electron-userland/electron-packager/blob/master/readme.md#building-windows-apps-from-non-windows-platforms)
  for details**
* API documentation moved from readme.md to docs/api.md (#296)

### Fixed

* [darwin/mas] The OSX icon is properly replaced when Electron ≥ 0.37.4 is used (#301)
* `default_app.asar` is deleted during packaging (necessary when Electron ≥ 0.37.4 is used).
  The `default_app` folder is still deleted for older Electron versions (#298, #311)

## [6.0.0] - 2016-03-28

### Added

* Add support for a new target platform, Mac App Store (`mas`), including signing OS X apps
  (#223, #278)
* Add `app-copyright` parameter (#223)
* Add `tmpdir` parameter to specify a custom temp directory (#230); set to `false` to disable
  using a temporary directory at all (#251, #276)
* Add `NEWS.md`, a human-readable list of changes in each version (since 5.2.0) (#263)

### Changed

* **The GitHub repository has been moved into an organization,
  [electron-userland](https://github.com/electron-userland)**
* Allow the `ignore` parameter to take a function (#247)
* [contributors] Update Standard (JavaScript coding standard) package to 5.4.x
* [contributors] Add code coverage support via Coveralls (#257)
* Better docs around contributing to the project (#258)
* Ignore the directory specified by the `out` parameter by default (#255)
* [darwin/mas] Add support for merging arbitrary plist files and adding arbitrary resource
  files (#253)
* Split out the code to sign OS X apps into a separate Node module,
  [electron-osx-sign](https://github.com/electron-userland/electron-osx-sign) (#223)
* [darwin/mas] **BREAKING**: The `sign` parameter is now `osx-sign` (for better cross-platform
  compatibility) and optionally takes several of the same sub-parameters as
  electron-osx-sign (#286)

### Deprecated

* [win32] `version-string.LegalCopyright` is deprecated in favor of `app-copyright` (#268)

### Fixed

* [darwin/mas] Ensure `CFBundleVersion` and `CFBundleShortVersionString` are strings (#250)
* [darwin/mas] Correctly set the helper bundle ID in all relevant plist files (#223)
* [darwin/mas] OSX-specific binaries are correctly renamed to the application name (#244, #293)

  **If you are upgrading from ≤ 5.2.1 and building for a `darwin` target, you may experience problems. See #323 for details.**

## [5.2.1] - 2016-01-17

### Changed

* [win32] Add support for Windows for the `app-version` and `build-version` parameters (#229)
* If `appname` and/or `version` are omitted from the parameters, infer from `package.json` (#94)

### Deprecated

* [win32] `version-string.FileVersion` and `version-string.ProductVersion` are deprecated in
  favor of `app-version` and `build-version`, respectively (#229)

### Fixed

* Remove `default_app` from built packages (#206)
* Add documentation for optional arguments (#226)
* [darwin] Don't declare helper app as a protocol handler (#220)

## [5.2.0] - 2015-12-16

### Added

* Add `asar-unpack-dir` parameter (#174)
* [darwin] Add `app-category-type` parameter (#202)
* Add `strict-ssl` parameter (#209)

### Changed

* Ignore `node_modules/.bin` by default (#189)

----

For versions prior to 5.2.0, please see `git log`.

[7.0.3]: https://github.com/electron-userland/electron-packager/compare/v7.0.2...v7.0.3
[7.0.2]: https://github.com/electron-userland/electron-packager/compare/v7.0.1...v7.0.2
[7.0.1]: https://github.com/electron-userland/electron-packager/compare/v7.0.0...v7.0.1
[7.0.0]: https://github.com/electron-userland/electron-packager/compare/v6.0.2...v7.0.0
[6.0.2]: https://github.com/electron-userland/electron-packager/compare/v6.0.1...v6.0.2
[6.0.1]: https://github.com/electron-userland/electron-packager/compare/v6.0.0...v6.0.1
[6.0.0]: https://github.com/electron-userland/electron-packager/compare/v5.2.1...v6.0.0
[5.2.1]: https://github.com/electron-userland/electron-packager/compare/v5.2.0...v5.2.1
[5.2.0]: https://github.com/electron-userland/electron-packager/compare/v5.1.1...v5.2.0
