# Electron Packager: Changes by Version

## [Unreleased]

[Unreleased]: https://github.com/electron/electron-packager/compare/v17.0.0...main

### Changed

* Replaced `electron-notarize` with `@electron/notarize`.  The configuration options are unchanged. This migration is purely cosmetic.
* Added new `afterFinalizePackageTargets` hook. This hook exposes the platform/arch combinations that are being packaged when the `arch:all` or `platform:all` options are set.

## [17.0.0]

[17.0.0]: https://github.com/electron/electron-packager/compare/v16.0.0...v17.0.0

### Changed

* **BREAKING:** Replaced `electron-osx-sign` with `@electron/osx-sign`.  The accepted properties on the `osxSign` options object are now slightly different.  Please see the [migration guide](https://github.com/electron/osx-sign/blob/main/MIGRATION.md) for more information on these changes. (#1428)
* Replaced `asar` with `@electron/asar`. The configuration options are unchanged. This migration is purely cosmetic. (#1431)

### Fixed

* `ElectronAsarIntegrity` is now automatically removed from the `asar` option is disabled (#1281)

## [16.0.0] - 2022-08-23

[16.0.0]: https://github.com/electron/electron-packager/compare/v15.5.1...v16.0.0

### Fixed

* Properly import info logger (#1405)

### Changed

* Bump `got` to 2.0.0 (#1397)

### Removed

* Node 12 support (#1399)

## [15.5.2] - 2022-08-22

[15.5.2]: https://github.com/electron/electron-packager/compare/v15.5.1...v15.5.2

### Fixed

* Package should not log info on `--quiet` flag
* Ignore `node_gyp_bins` directory if it exists

## [15.5.1] - 2022-04-20

[15.5.1]: https://github.com/electron/electron-packager/compare/v15.5.0...v15.5.1

### Fixed

* Univeral builds single-arch components are now built sequentially instead of in parallel to fix race conditions in hooks
* The typescript definition for HookFunction now correctly allows an error to be passed

## [15.5.0] - 2022-04-19

[15.5.0]: https://github.com/electron/electron-packager/compare/v15.4.0...v15.5.0

### Added

* New `universal` architecture supported when packaging for macOS to generate a universal app
* `osxUniveral` option to allow providing options to `@electron/universal` when packaging a universal app

## [15.4.0] - 2021-09-10

[15.4.0]: https://github.com/electron/electron-packager/compare/v15.3.0...v15.4.0

### Added

* `extendHelperInfo` option to allow extending helper app `Info.plist` files (#1233)
* Automatically insert `ElectronAsarIntegrity` into `Info.plist` files (#1279)

### Fixed

* Compatibility with `electron-notarize@^1.1.0` (#1278)

## [15.3.0] - 2021-07-17

[15.3.0]: https://github.com/electron/electron-packager/compare/v15.2.0...v15.3.0

### Added

* Bundled app validation to ensure that both `package.json` and the main entry point exist (#1257)
* Support for customizing Windows targets on darwin/arm64 (#1260)
* Support for customizing Windows targets on WSL without Wine installed (#1260)

## [15.2.0] - 2020-12-04

[15.2.0]: https://github.com/electron/electron-packager/compare/v15.1.0...v15.2.0

### Added

* Upgrade `electron-osx-sign` to 0.5.0 which adds a new option, `entitlementsForFile` (#1189)

### Fixed

* Add package manager lockfiles to default ignore list (#1182)
* Allow checking official builds against prerelease versions (#1191)

## [15.1.0] - 2020-08-21

[15.1.0]: https://github.com/electron/electron-packager/compare/v15.0.0...v15.1.0

### Added

* add darwin/arm64 and mas/arm64 as official platform/arch combinations (#1168)

### Fixed

* TypeScript: ensure `OsxNotarizeOptions` definition contains credentials (#1167)

## [15.0.0] - 2020-06-27

[15.0.0]: https://github.com/electron/electron-packager/compare/v14.2.1...v15.0.0

### Added

* mac: app API key notarization (#1127)
* TypeScript definition (#1131)

### Changed

* Replace `cross-zip` with `extract-zip` (#1139)

### Removed

* Node &lt; 10 support (#1122)

## [14.2.1] - 2020-02-07

[14.2.1]: https://github.com/electron/electron-packager/compare/v14.2.0...v14.2.1

### Fixed

* mac: don't fail if the icon path doesn't exist (#1101)
* win32: correctly catch missing wine exceptions (#1117)

## [14.2.0] - 2020-01-13

[14.2.0]: https://github.com/electron/electron-packager/compare/v14.1.1...v14.2.0

### Added

* `electronZipDir` option (#1094)

## [14.1.1] - 2019-11-19

[14.1.1]: https://github.com/electron/electron-packager/compare/v14.1.0...v14.1.1

### Fixed

* Regression that caused the symlink test on Windows to not work as intended (#1071)
* Always initialize proxy support when running the CLI (#1077)
* Clarify the error message when infer cannot find a package.json file (#1079)
* Handle a missing inferred app version better (#1079)

### Chores

* Upgrade `electron-notarize` to `^0.2.0` (#1069)

## [14.1.0] - 2019-10-28

[14.1.0]: https://github.com/electron/electron-packager/compare/v14.0.6...v14.1.0

### Added

* (darwin/mas only) `usageDescription` option (#1049)
* Support for official win32/arm64 builds (#1053)

## [14.0.6] - 2019-09-09

[14.0.6]: https://github.com/electron/electron-packager/compare/v14.0.5...v14.0.6

### Fixed

* Send the properly formatted options from the CLI to electron-osx-sign (#1047)

## [14.0.5] - 2019-08-28

[14.0.5]: https://github.com/electron/electron-packager/compare/v14.0.4...v14.0.5

### Fixed

* Ensure that CFBundleExecutable and friends are correct for helper apps (#1046)

## [14.0.4] - 2019-07-30

[14.0.4]: https://github.com/electron/electron-packager/compare/v14.0.3...v14.0.4

### Fixed

* Packaging apps based on Electron >= 6.0.0 correctly renames and packages the new
  Electron GPU Helper bundles (#1036)

## [14.0.3] - 2019-07-18

[14.0.3]: https://github.com/electron/electron-packager/compare/v14.0.2...v14.0.3

### Fixed

* Packaging Electron 6 based apps now correctly renames and packages the new
  Electron Helper bundles (#1033)

## [14.0.2] - 2019-07-18

[14.0.2]: https://github.com/electron/electron-packager/compare/v14.0.1...v14.0.2

### Fixed

* Warn Windows 7 users of the unzip dependencies (#1030)

## [14.0.1] - 2019-07-02

[14.0.1]: https://github.com/electron/electron-packager/compare/v14.0.0...v14.0.1

### Changed

* Upgrade `fs-extra` to `^8.1.0` (#993)

### Fixed

* Host info shows OS release

## [14.0.0] - 2019-06-20

[14.0.0]: https://github.com/electron/electron-packager/compare/v13.1.1...v14.0.0

### Added

* Ignore system junk files by default (#1005)

### Fixed

* Handle inference when `electron-prebuilt-compile` points to a non-version (#978)

### Changed

* Replace `extract-zip` with `cross-zip` - on macOS/Linux, the `zip` binary is required; on Windows,
  a relatively recent Powershell and .NET runtime is required, see `cross-zip` for details (#984)
* Convert from `electron-download` to `@electron/get` (#1002). Drops support for versions of Electron
  &lt; 1.3.2, plus all of the `download` options have changed, notably:
  * `cache` is now `cacheRoot`
  * `strictSSL` is now `rejectUnauthorized`
  * The `mirror` URL string is now a set of options defined by `mirrorOptions`
  * `quiet` is removed as the default downloader no longer has a progress bar
* Linux/ia32 support for Electron >= 4 is downgraded to a warning from `@electron/get` (#1016)

### Removed

* Node &lt; 8 support (#973)

## [13.1.1] - 2019-03-04

[13.1.1]: https://github.com/electron/electron-packager/compare/v13.1.0...v13.1.1

### Fixed

* Linux/ia32 is no longer officially supported for Electron >= 4 (#957)

## [13.1.0] - 2019-02-19

[13.1.0]: https://github.com/electron/electron-packager/compare/v13.0.1...v13.1.0

### Added

* Support for inferring version from Electron nightlies (#931)

### Fixed

* Infer versions from `electron-prebuilt-compile` better (#932)
* Upgrade `asar` to `^1.0.0`, which removes a vulnerable transitive dependency (#952)

## [13.0.1] - 2018-12-12

[13.0.1]: https://github.com/electron/electron-packager/compare/v13.0.0...v13.0.1

### Fixed

* Ensure relative out dirs are correctly ignored when copying (#919)

## [13.0.0] - 2018-12-04

[13.0.0]: https://github.com/electron/electron-packager/compare/v12.2.0...v13.0.0

### Added

* `prebuiltAsar` option to specify a prebuilt ASAR file (#823)
* support for macOS Mojave app notarization (#899)

### Changed

* **Dropped support for running on Node &lt; 6.0.** (#900)

### Removed

* Deprecated target arch APIs (#915)
* The callback version of the API (use `nodeify` if you need that syntax style) (#916)

## [12.2.0] - 2018-10-02

[12.2.0]: https://github.com/electron/electron-packager/compare/v12.1.2...v12.2.0

### Added

* darwinDarkModeSupport option to support macOS Mojave dark mode for older Electron versions (#893)

### Fixed

* Don't handle EH/NP Helpers if they don't exist (#894)

## [12.1.2] - 2018-09-12

[12.1.2]: https://github.com/electron/electron-packager/compare/v12.1.1...v12.1.2

### Fixed

* Prune user-namespaced modules (#889)

## [12.1.1] - 2018-08-18

[12.1.1]: https://github.com/electron/electron-packager/compare/v12.1.0...v12.1.1

### Changed

* Host arch utilities moved to electron-download. This is not a breaking change, as the existing API
  has been kept the same.

### Deprecated

* `hostArch` and `unameArch` in `electron-packager/targets`, replaced with `host` and `uname` in
  `electron-download/lib/arch`, respectively

## [12.1.0] - 2018-05-18

[12.1.0]: https://github.com/electron/electron-packager/compare/v12.0.2...v12.1.0

### Added

* `--version` shows the Packager/Node versions & host platform/arch (#841)

### Fixed

* `mips64el` arch is only available with Electron 1.8.x (#843)
* better detection of node modules (#847)

## [12.0.2] - 2018-05-02

[12.0.2]: https://github.com/electron/electron-packager/compare/v12.0.1...v12.0.2

### Fixed

* Support for Node 10 via the CLI (#835)

### Deprecated

* The callback version of the API (use `nodeify` if you need that syntax style) (#837)

## [12.0.1] - 2018-04-10

[12.0.1]: https://github.com/electron/electron-packager/compare/v12.0.0...v12.0.1

### Fixed

* Upgraded `galactus` to `^0.2.1` to fix a bug with relative paths

## [12.0.0] - 2018-04-03

[12.0.0]: https://github.com/electron/electron-packager/compare/v11.2.0...v12.0.0

### Changed

* `prune` exclusively utilizes the `galactus` module for pruning devDependencies, instead of
  depending on package managers (#819)
* `electron-packager` is no longer ignored by default (#819)
* A warning is emitted when an Electron module is a production dependency (#819)

### Removed

* `packageManager` option (#819)

## [11.2.1] - 2019-01-02

[11.2.1]: https://github.com/electron/electron-packager/compare/v11.2.0...v11.2.1

### Fixed

* Don't handle EH/NP Helpers if they don't exist (Backport of #894)

## [11.2.0] - 2018-03-24

[11.2.0]: https://github.com/electron/electron-packager/compare/v11.1.0...v11.2.0

### Added

* Utility function to execute hooks serially (#814)

## [11.1.0] - 2018-03-04

[11.1.0]: https://github.com/electron/electron-packager/compare/v11.0.1...v11.1.0

### Added

* Support for MAS Login Helper (Electron 2.0.0-beta.1 and above) (#807)

## [11.0.1] - 2018-02-12

[11.0.1]: https://github.com/electron/electron-packager/compare/v11.0.0...v11.0.1

### Fixed

* `rcedit` module updated to 1.0.0, which fixes some bugs (#804)
* `--help` prints usage to stdout (#805)

## [11.0.0] - 2018-02-06

[11.0.0]: https://github.com/electron/electron-packager/compare/v10.1.2...v11.0.0

### Added

* `linux` platform, `mips64el` arch builds (Electron 1.8.2-beta.5 and above) (#800)

### Changed

* `all` or `platform=linux, arch=all` now include `arch=mips64el` if the Electron version specified
  is 1.8.2-beta.5 or above (#800)

## [10.1.2] - 2018-01-26

[10.1.2]: https://github.com/electron/electron-packager/compare/v10.1.1...v10.1.2

### Fixed

* `overwrite: true` when no platform/arch is specified (#794)

## [10.1.1] - 2018-01-02

[10.1.1]: https://github.com/electron/electron-packager/compare/v10.1.0...v10.1.1

### Fixed

* ARM detection with prebuilt armv7l Node.js (#783)
* Don't create `yarn.lock` when pruning with Yarn (#784)

## [10.1.0] - 2017-11-19

[10.1.0]: https://github.com/electron/electron-packager/compare/v10.0.0...v10.1.0

### Added

* Option to set the executable name separate from the app name (#758)

### Fixed

* `mz` dependency (#759)

## [10.0.0] - 2017-11-19

[10.0.0]: https://github.com/electron/electron-packager/compare/v9.1.0...v10.0.0

### Changed

* Switch from `minimist` to `yargs-parser` (#732)
* Electron Packager only officially supports Node versions that are supported by the
  NodeJS team (#747)
* Refactor to use `Promise`s internally. This has the side effect of somewhat parallelizing
  building two or more targets at once and/or two or more functions for a given hook, via
  `Promise.all` (#753)

## [9.1.0] - 2017-09-15

[9.1.0]: https://github.com/electron/electron-packager/compare/v9.0.1...v9.1.0

### Added

* `hostArch()` and `allOfficialArchsForPlatformAndVersion()` (#727)

### Changed

* CLI arguments with nonstandard argument values emit warnings (#722)

### Deprecated

* In the CLI, `--tmpdir=false` has been deprecated in favor of `--no-tmpdir` (#722)

## [9.0.1] - 2017-09-02

[9.0.1]: https://github.com/electron/electron-packager/compare/v9.0.0...v9.0.1

### Fixed

* Inferring `win32metadata.CompanyName` from `author` in `package.json` when it's an Object (#718)

## [9.0.0] - 2017-08-23

[9.0.0]: https://github.com/electron/electron-packager/compare/v8.7.2...v9.0.0

### Added

* API hook for afterPrune (#677)
* Package manager-agnostic pruning support (set `packageManager` to `false`) (#690)
* `linux` platform, `arm64` arch builds (Electron 1.8.0 and above) (#711)

### Changed

* Promise support for `packager` - function returns a Promise instead of the return value of the
  callback (#658)
* `win32metadata.CompanyName` defaults to `author` name from nearest `package.json` (#667)
* `win32metadata.FileDescription` defaults to `productName` or `name` from
  nearest `package.json` (#667)
* `win32metadata.OriginalFilename` defaults to renamed `.exe` (#667)
* `win32metadata.ProductName` defaults to `productName` or `name` from nearest `package.json` (#667)
* `win32metadata.InternalName` defaults to `productName` or `name` from
  nearest `package.json` (#667)
* Warn when downloading from the official Electron releases and the arch/platform combination
  specified is invalid (#562)
* Do not error out immediately if a `download.mirror` is specified and an unofficial arch/platform
  is specified (#670)
* Allow spaces when specifying archs/platforms as a string, rather than an array (#487)
* The `extraResource` option works on all target platforms (#637)
* `all` or `platform=linux, arch=all` now include `arch=arm64` if the Electron version specified is
  1.8.0 or above (#711)

### Fixed

* `common.warning` for codesigning (#694)

### Removed

* `version` is removed in favor of `electronVersion` (CLI: `--electron-version`) (#665)
* `version-string` is removed in favor of `win32metadata` (#668)
* Options set via the JavaScript API formatted in kebab-case (i.e., with hyphens) are removed in
  favor of their camelCase variants, per JavaScript naming standards (#669)

## [8.7.2] - 2017-06-25

[8.7.2]: https://github.com/electron/electron-packager/compare/v8.7.1...v8.7.2

### Fixed

* Stop yarn creating `.bin` folders when pruning (#678)

## [8.7.1] - 2017-06-05

[8.7.1]: https://github.com/electron/electron-packager/compare/v8.7.0...v8.7.1

### Fixed

* Usage docs for `win32metadata.application-manifest` and `win32metadata.requested-execution-level`

## [8.7.0] - 2017-05-01

[8.7.0]: https://github.com/electron/electron-packager/compare/v8.6.0...v8.7.0

### Added

* `packageManager` (`--package-manager` via CLI) option (#618)
* `win32metadata.application-manifest` option (#610)
* `win32metadata.requested-execution-level` option (#610)

### Fixed

* Support for `extract-zip` >= 1.6.1

## [8.6.0] - 2017-03-14

[8.6.0]: https://github.com/electron/electron-packager/compare/v8.5.2...v8.6.0

### Added

* Limited support for electron-prebuilt-compile (#608)

### Changed

* Options formatted in kebab-case (i.e., with hyphens) are available in camelCase, per JavaScript naming standards (#580)
* rcedit upgraded to 0.8.0

### Deprecated

* Options formatted in kebab-case (i.e., with hyphens) are deprecated in favor of their camelCase variants, per JavaScript naming standards (#580)

## [8.5.2] - 2017-02-19

[8.5.2]: https://github.com/electron/electron-packager/compare/v8.5.1...v8.5.2

### Fixed

* Prepend all warning messages with "WARNING:" (#593)
* Ignore the generated temporary directory on Linux (#596)
* Prevent app names from ending in " Helper" (#600)

## [8.5.1] - 2017-01-22

[8.5.1]: https://github.com/electron/electron-packager/compare/v8.5.0...v8.5.1

### Fixed

* Show CLI option when showing option deprecation message (#560)

## [8.5.0] - 2017-01-10

[8.5.0]: https://github.com/electron/electron-packager/compare/v8.4.0...v8.5.0

### Added

* `electronVersion` (`--electron-version` via CLI) option (#547)

### Deprecated

* `version` is deprecated in favor of `electronVersion` (`--electron-version` via CLI) (#547)

## [8.4.0] - 2016-12-08

[8.4.0]: https://github.com/electron/electron-packager/compare/v8.3.0...v8.4.0

### Added

* `quiet` option (#541)

### Fixed

* Better type checking when validating arch/platform (#534)

## [8.3.0] - 2016-11-16

[8.3.0]: https://github.com/electron/electron-packager/compare/v8.2.0...v8.3.0

### Changed

* Upgrade to electron-osx-sign 0.4.x (#384)

### Fixed

* Clarify symlink error message for Windows

## [8.2.0] - 2016-10-29

[8.2.0]: https://github.com/electron/electron-packager/compare/v8.1.0...v8.2.0

### Added

* Allow `extend-info` to specify an object instead of a filename (#510)

### Fixed

* Retrieving metadata from `package.json` by upgrading `get-package-info` (#505)
* Typo when using `extend-info` (#510)

## [8.1.0] - 2016-09-30

[8.1.0]: https://github.com/electron/electron-packager/compare/v8.0.0...v8.1.0

### Added

* `.o` and `.obj` files are ignored by default (#491)
* Electron downloads are now checked against their published checksums (#493)
* Documentation for `download.quiet` option to enable/disable progress bar (#494)
* The `build-version` property, when unspecified, now defaults to the
  `app-version` property value on Windows (#501)

## [8.0.0] - 2016-09-03

[8.0.0]: https://github.com/electron/electron-packager/compare/v7.7.0...v8.0.0

### Added

* `win32metadata` option (#331, #463)
* `linux` platform, `armv7l` arch support (#106, #474)

### Changed

* `all` now includes the `linux` platform, `armv7l` arch combination
* Default the `platform` option to the host platform (#464)
* Default the `arch` option to the host arch (#36, #464)
* Default the `prune` option to `true` (#235, #472)

### Fixed

* Allow scoped package names as Electron app names - invalid characters are replaced with
  hyphens (#308, #455)

### Deprecated

* `version-string` is deprecated in favor of `win32metadata` (#331, #463)

### Removed

* `asar-unpack` is removed in favor of `asar.unpack`
* `asar-unpack-dir` is removed in favor of `asar.unpackDir`
* `cache` is removed in favor of `download.cache`
* `strict-ssl` is removed in favor of `download.strictSSL`

## [7.7.0] - 2016-08-20

[7.7.0]: https://github.com/electron/electron-packager/compare/v7.6.0...v7.7.0

### Added

* The `package.json` `version` property is the default app version if `--app-version` is
  unspecified (#449)

### Changed

* [darwin/mas] Explicitly disallow `osx-sign.binaries` (#459)

## [7.6.0] - 2016-08-14

[7.6.0]: https://github.com/electron/electron-packager/compare/v7.5.1...v7.6.0

### Added

* [API] hook for afterCopy (#448)
* [darwin/mas] Documentation for `protocol` and `protocol-name` options (#121, #450)

### Changed

* [CLI] Minimum Node version is enforced (#454)

### Fixed

* [CLI] ensure --out has either a string or null value (#442)
* Use `get-package-info` (again) to support finding prebuilt in parent directories (#445)

## [7.5.1] - 2016-08-06

[7.5.1]: https://github.com/electron/electron-packager/compare/v7.5.0...v7.5.1

### Fixed

* Resolve to absolute path when inferring app name/Electron version (#440)

## [7.5.0] - 2016-08-04

[7.5.0]: https://github.com/electron/electron-packager/compare/v7.4.0...v7.5.0

### Added

* Support the new `electron` package name (#435)

## [7.4.0] - 2016-07-31

[7.4.0]: https://github.com/electron/electron-packager/compare/v7.3.0...v7.4.0

### Added

* Basic debugging messages via the `debug` module - see CONTRIBUTING.md for usage (#433)

### Changed

* Clearer error message when inferring the app name and/or Electron version fails

### Fixed

* (Test) apps named "Electron" can be packaged successfully (#415)

## [7.3.0] - 2016-07-10

[7.3.0]: https://github.com/electron/electron-packager/compare/v7.2.0...v7.3.0

### Added

* `asar` options can be specified as an `Object` (via the API) or with dot notation (via the CLI) -
  see the respective docs for details (#353, #417)

### Deprecated

* `asar-unpack` is deprecated in favor of `asar.unpack` (#417)
* `asar-unpack-dir` is deprecated in favor of `asar.unpackDir` (#417)

## [7.2.0] - 2016-07-03

[7.2.0]: https://github.com/electron/electron-packager/compare/v7.1.0...v7.2.0

### Added

* `derefSymlinks` option (#410)

### Fixed

* Clarified message when `wine` is not found (#357)

## [7.1.0] - 2016-06-22

[7.1.0]: https://github.com/electron/electron-packager/compare/v7.0.4...v7.1.0

### Added

* Add `afterExtract` hook (#354, #403)

## [7.0.4] - 2016-06-14

[7.0.4]: https://github.com/electron/electron-packager/compare/v7.0.3...v7.0.4

### Fixed

* Clarified app name/Electron version error message (#390)

## [7.0.3] - 2016-05-31

[7.0.3]: https://github.com/electron/electron-packager/compare/v7.0.2...v7.0.3

### Changed

* [contributors] Code contributions need to be validated in "strict" mode (#342, #351)

### Fixed

* CLI output truncated when using Node 6 (and possibly earlier) (#381)

## [7.0.2] - 2016-05-18

[7.0.2]: https://github.com/electron/electron-packager/compare/v7.0.1...v7.0.2

### Fixed

* The default `.git` ignore only ignores that directory (#344)
* Specifying the `download.strictSSL` CLI parameter no longer triggers a deprecation warning for
  `strict-ssl` (#349)

## [7.0.1] - 2016-04-21

[7.0.1]: https://github.com/electron/electron-packager/compare/v7.0.0...v7.0.1

### Fixed

* Not specifying `strict-ssl` CLI parameter no longer triggers a deprecation warning (#335)

## [7.0.0] - 2016-04-17

[7.0.0]: https://github.com/electron/electron-packager/compare/v6.0.2...v7.0.0

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

[6.0.2]: https://github.com/electron/electron-packager/compare/v6.0.1...v6.0.2

### Changed

* [win32] `rcedit` dependency updated to 0.5.x. **The DLL mentioned in the 6.0.1 release notes
  is no longer required.**

## [6.0.1] - 2016-04-08

[6.0.1]: https://github.com/electron/electron-packager/compare/v6.0.0...v6.0.1

### Changed

* [win32] `rcedit` dependency updated to 0.4.x. **A new DLL is required to run the new version
  of rcedit, please see [the documentation](https://github.com/electron/electron-packager/blob/main/README.md#building-windows-apps-from-non-windows-platforms)
  for details**
* API documentation moved from readme.md to docs/api.md (#296)

### Fixed

* [darwin/mas] The OSX icon is properly replaced when Electron ≥ 0.37.4 is used (#301)
* `default_app.asar` is deleted during packaging (necessary when Electron ≥ 0.37.4 is used).
  The `default_app` folder is still deleted for older Electron versions (#298, #311)

## [6.0.0] - 2016-03-28

[6.0.0]: https://github.com/electron/electron-packager/compare/v5.2.1...v6.0.0

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

[5.2.1]: https://github.com/electron/electron-packager/compare/v5.2.0...v5.2.1

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

[5.2.0]: https://github.com/electron/electron-packager/compare/v5.1.1...v5.2.0

### Added

* Add `asar-unpack-dir` parameter (#174)
* [darwin] Add `app-category-type` parameter (#202)
* Add `strict-ssl` parameter (#209)

### Changed

* Ignore `node_modules/.bin` by default (#189)

----

For versions prior to 5.2.0, please see `git log`.
