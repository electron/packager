# Changes by Version

## Unreleased


## [6.0.0] - YYYY-MM-DD

### Added

* Add support for a new target platform, Mac App Store (`mas`) (#223)
* Add `app-copyright` parameter (#223)
* Add `tmpdir` parameter to specify a custom temp directory (#230)
* Add `NEWS.md`, a human-readable list of changes in each version (since 5.2.0) (#263)

### Changed

* **The GitHub repository has been moved into an organization,
  [electron-userland](https://github.com/electron-userland).**
* Allow the `ignore` parameter to take a function (#247)
* [contributors] Update Standard (JavaScript coding standard) package to 5.4.x
* [contributors] Add code coverage support via Coveralls (#257)
* Better docs around contributing to the project (#258)
* Ignore the directory specified by the `out` parameter by default (#255)
* [darwin/mas] Add support for merging arbitrary plist files and adding arbitrary resource
  files (#253)

### Deprecated

* [win32] `version-string.LegalCopyright` is deprecated in favor of `app-copyright` (#268)

### Fixed

* [darwin] Ensure `CFBundleVersion` and `CFBundleShortVersionString` are strings (#250)
* [darwin] Correctly set the helper bundle ID in all relevant plist files (#223)

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

[6.0.0]: https://github.com/maxogden/electron-packager/compare/v5.2.1...v6.0.0
[5.2.1]: https://github.com/maxogden/electron-packager/compare/v5.2.0...v5.2.1
[5.2.0]: https://github.com/maxogden/electron-packager/compare/v5.1.1...v5.2.0
