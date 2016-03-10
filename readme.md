# electron-packager

Package your [Electron](http://electron.atom.io) app into OS-specific bundles (`.app`, `.exe`, etc.) via JavaScript or the command line.

[![Build Status](https://travis-ci.org/electron-userland/electron-packager.svg?branch=master)](https://travis-ci.org/electron-userland/electron-packager)
[![Coverage Status](https://coveralls.io/repos/github/electron-userland/electron-packager/badge.svg?branch=master)](https://coveralls.io/github/electron-userland/electron-packager?branch=master)

## About

Electron Packager is a command line tool that packages electron app source code into executables like `.app` or `.exe` along with a copy of Electron.

Note that packaged Electron applications can be relatively large. A zipped barebones OS X Electron application is around 40MB.

### Electron Packager is an [OPEN Open Source Project](http://openopensource.org/)

Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

See [CONTRIBUTING.md](contributing.md) and [openopensource.org](http://openopensource.org/) for more details.

## Supported Platforms

Electron Packager is known to run on the following **host** platforms:

* Windows (32/64 bit)
* OS X
* Linux (x86/x86_64)

It generates executables/bundles for the following **target** platforms:

* Windows (also known as `win32`, for both 32/64 bit)
* OS X (also known as `darwin`) / [Mac App Store](http://electron.atom.io/docs/v0.36.0/tutorial/mac-app-store-submission-guide/) (also known as `mas`)<sup>*</sup>
* Linux (for both x86/x86_64)

<sup>*</sup> *Note for OS X / MAS target bundles: the `.app` bundle can only be signed when building on a host OS X platform.*

## Installation

```sh
# for use in npm scripts
npm install electron-packager --save-dev

# for use from cli
npm install electron-packager -g
```

## Usage

### From the Command Line

Running electron-packager from the command line has this basic form:

```
electron-packager <sourcedir> <appname> --platform=<platform> --arch=<arch> [optional flags...]
```

This will:

- Find or download the correct release of Electron
- Use that version of Electron to create a app in `<out>/<appname>-<platform>-<arch>` *(this can be customized via an optional flag)*

For details on the optional flags, run `electron-packager --help` or see [usage.txt](https://github.com/electron-userland/electron-packager/blob/master/usage.txt).

If `appname` is omitted, this will use the name specified by "productName" or "name" in the nearest package.json.

You should be able to launch the app on the platform you built for. If not, check your settings and try again.

**Be careful** not to include `node_modules` you don't want into your final app. `electron-packager`, `electron-prebuilt` and `.git` will be ignored by default. You can use `--ignore` to ignore files and folders via a regular expression. For example, `--ignore=node_modules/package-to-ignore` or `--ignore="node_modules/(some-package[0-9]*|dev-dependency)"`.

#### Example

Let's assume that you have made an app based on the [electron-quick-start](https://github.com/atom/electron-quick-start) repository on a OS X or Linux host platform with the following file structure:

```
foobar
├─package.json
├─index.html
├[…other files, like LICENSE…]
└─script.js
```

…and that the following is true:

* `electron-packager` is installed globally
* `name` in `package.json` has been set to `FooBar`
* `npm install` for the `FooBar` app has been run at least once

When one runs the following command for the first time in the `foobar` directory:

```
electron-packager . --all
```

`electron-packager` will do the following:

* Use the current directory for the `sourcedir`
* Infer the `appname` from the `name` in `package.json`
* download [all supported target platforms and arches](#supported-platforms) of Electron using the installed `electron-prebuilt` version (and cache the downloads in `~/.electron`)
* For the `darwin` build, as an example:
  * build the OS X `FooBar.app`
  * place `FooBar.app` in `foobar/FooBar-darwin-x64/` (since an `out` directory was not specified, it used the current working directory)

The file structure now looks like:

```
foobar
├┬FooBar-darwin-x64
│├┬FooBar.app
││└[…Mac app contents…]
│├─LICENSE
│└─version
├─package.json
├─index.html
├[…other files, like LICENSE…]
└─script.js
```

The `FooBar.app` folder generated can be executed by a system running OS X, which will start the packaged Electron app. This is also true of the Windows x64 build on a system running a new enough version of Windows for a 64-bit system, and so on.

### Programmatic API
```javascript
var packager = require('electron-packager')
packager(opts, function done (err, appPath) { })
```
#### packager(opts, callback)

##### opts

**Required**

`arch` - *String*

  Allowed values: *ia32, x64, all*

  The target system architecture(s) to build for.
  Not required if the `all` option is set.
  If `arch` is set to `all`, all supported architectures for the target platforms specified by `platform` will be built.
  Arbitrary combinations of individual architectures are also supported via a comma-delimited string or array of strings.
  The non-`all` values correspond to the architecture names used by [Electron releases](https://github.com/atom/electron/releases).

`dir` - *String*

  The source directory.

`platform` - *String*

  Allowed values: *linux, win32, darwin, mas, all*

  The target platform(s) to build for.
  Not required if the `all` option is set.
  If `platform` is set to `all`, all [supported target platforms](#supported-platforms) for the target architectures specified by `arch` will be built.
  Arbitrary combinations of individual platforms are also supported via a comma-delimited string or array of strings.
  The non-`all` values correspond to the platform names used by [Electron releases](https://github.com/atom/electron/releases).

**Optional**

***All Platforms***

`all` - *Boolean*

  When `true`, sets both `arch` and `platform` to `all`.

`app-copyright` - *String*

  The human-readable copyright line for the app. Maps to the `LegalCopyright` metadata property on Windows, and `NSHumanReadableCopyright` on OS X.

`app-version` - *String*

  The release version of the application. Maps to the `ProductVersion` metadata property on Windows, and `CFBundleShortVersionString` on OS X.

`asar` - *Boolean*

  Whether to package the application's source code into an archive, using [Electron's archive format](https://github.com/atom/asar). Reasons why you may want to enable this feature are described in [an application packaging tutorial in Electron's documentation](http://electron.atom.io/docs/v0.36.0/tutorial/application-packaging/).

  Defaults to `false`.

`asar-unpack` - *String*

  A [glob expression](https://github.com/isaacs/minimatch#features), when specified, unpacks the file with matching names to the `app.asar.unpacked` directory.

`asar-unpack-dir` - *String*

  Unpacks the dir to `app.asar.unpacked` directory whose names exactly match this string. The `asar-unpack-dir` is relative to `dir`.
  For example, `asar-unpack-dir=sub_dir` will unpack the directory `/<dir>/sub_dir`.

`build-version` - *String*

  The build version of the application. Maps to the `FileVersion` metadata property on Windows, and `CFBundleVersion` on OS X.

`cache` - *String*

  The directory where prebuilt, pre-packaged Electron downloads are cached. Defaults to `$HOME/.electron`.

`icon` - *String*

  Currently you must look for conversion tools in order to supply an icon in the format required by the platform:

  - OS X: `.icns`
  - Windows: `.ico` ([See below](#building-windows-apps-from-non-windows-platforms) for details on non-Windows platforms)
  - Linux: this option is not required, as the dock/window list icon is set via [the icon option in the BrowserWindow constructor](http://electron.atom.io/docs/v0.30.0/api/browser-window/#new-browserwindow-options). Setting the icon in the file manager is not currently supported.

If the file extension is omitted, it is auto-completed to the correct extension based on the platform, including when `--platform=all` is in effect.

`ignore` - *RegExp* or *Function*

  A pattern which specifies which files to ignore when copying files to create the package(s). The `out` directory is ignored by default, along with the `electron-prebuilt` and `electron-packager` Node modules, the `.git` directory, and `node_modules/.bin`. Alternatively, this can be a predicate function that, given the file path, returns true if the file should be ignored or false if the file should be kept.

`name` - *String*
  The application name. If omitted, it will use the "productName" or "name" of the nearest package.json.

`out` - *String*

  The base directory where the finished package(s) are created. Defaults to the current working directory.

`overwrite` - *Boolean*

  Whether to replace an already existing output directory for a given platform (`true`) or skip recreating it (`false`). Defaults to `false`.

`prune` - *Boolean*

  Runs [`npm prune --production`](https://docs.npmjs.com/cli/prune) before starting to package the app.

`strict-ssl` - *Boolean*

  Whether SSL certificates are required to be valid when downloading Electron. **Defaults to `true`**.

`tmpdir` - *String* or *false*

  The base directory to use as a temp directory. Defaults to the system temp directory. Set to `false` to disable use of a temporary directory.

`version` - *String*

  The Electron version with which the app is built (without the leading 'v') - for example, [`0.33.9`](https://github.com/atom/electron/releases/tag/v0.33.9). See [Electron releases](https://github.com/atom/electron/releases) for valid versions. If omitted, it will use the version of the nearest local installation of electron-prebuilt.


***OS X/Mac App Store targets only***

`app-bundle-id` - *String*

  The bundle identifier to use in the application's plist.

`app-category-type` - *String*

  The application category type, as shown in the Finder via *View -> Arrange by Application Category* when viewing the Applications directory.

  For example, `app-category-type=public.app-category.developer-tools` will set the application category to *Developer Tools*.

  Valid values are listed in [Apple's documentation](https://developer.apple.com/library/ios/documentation/General/Reference/InfoPlistKeyReference/Articles/LaunchServicesKeys.html#//apple_ref/doc/uid/TP40009250-SW8).

`extend-info` - *String*

  Filename of a plist file; the contents are added to the app's plist. Entries in `extend-info` override entries in the base plist file supplied by electron-prebuilt, but are overridden by other explicit arguments such as `app-version` or `app-bundle-id`.

`extra-resource` - *String* or *Array*

  Filename of a file to be copied directly into the app's `Contents/Resources` directory.

`helper-bundle-id` - *String*

  The bundle identifier to use in the application helper's plist.

`osx-sign` - *Object* or *true*

  If present, signs OS X target apps when the host platform is OS X and XCode is installed. When the value is `true`, pass default configuration to the signing module. The configuration values listed below can be customized when the value is an `Object`. See [electron-osx-sign](https://www.npmjs.com/package/electron-osx-sign#opts) for more detailed option descriptions and the defaults.
  - `identity` - *String*: The identity used when signing the package via `codesign`.
  - `entitlements` - *String*: The path to the 'parent' entitlements.
  - `entitlements-inherit` - *String*: The path to the 'child' entitlements.

***Windows targets only***

`version-string` - *Object*

  Object (also known as a "hash") of application metadata to embed into the executable:
  - `CompanyName`
  - `LegalCopyright` (**deprecated** and will be removed in a future major version, please use the top-level `app-copyright` parameter instead)
  - `FileDescription`
  - `OriginalFilename`
  - `FileVersion` (**deprecated** and will be removed in a future major version, please use the top-level `build-version` parameter instead)
  - `ProductVersion` (**deprecated** and will be removed in a future major version, please use the top-level `app-version` parameter instead)
  - `ProductName`
  - `InternalName`

##### callback

`err` - *Error* (or *Array*, in the case of an `ncp` error)

  Contains errors, if any.

`appPath` - *String*

  Path to the newly created application.

## Building Windows apps from non-Windows platforms

Building an Electron app for the Windows platform with a custom icon requires editing the `Electron.exe` file. Currently, electron-packager uses [node-rcedit](https://github.com/atom/node-rcedit) to accomplish this. A Windows executable is bundled in that node package and needs to be run in order for this functionality to work, so on non-Windows host platforms, [Wine](https://www.winehq.org/) needs to be installed. On OS X, it is installable via [Homebrew](http://brew.sh/).

## Related

- [electron-builder](https://www.npmjs.com/package/electron-builder) - for creating installer wizards
- [grunt-electron](https://github.com/sindresorhus/grunt-electron) - grunt plugin for electron-packager
- [electron-packager-interactive](https://github.com/Urucas/electron-packager-interactive) - an interactive CLI for electron-packager
