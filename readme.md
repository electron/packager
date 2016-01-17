# electron-packager

Package your [Electron](http://electron.atom.io) app into OS-specific bundles (`.app`, `.exe`, etc.) via JavaScript or the command line. Supports building Windows, Linux or Mac executables.

[![Build Status](https://travis-ci.org/maxogden/electron-packager.svg?branch=master)](https://travis-ci.org/maxogden/electron-packager)

## About

Electron Packager is a command line tool that packages electron app source code into executables like `.app` or `.exe` along with a copy of Electron.

This module was developed as part of [Dat](http://dat-data.com/), a grant funded non-profit open source project. It is maintained by volunteers. If you are benefitting from this module please consider making contributions back.

Note that packaged Electron applications can be relatively large. A zipped barebones OS X Electron application is around 40MB.

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
electron-packager <sourcedir> <appname> --platform=<platform> --arch=<arch> --version=<Electron version> [optional flags...]
```

This will:

- Find or download the correct release of Electron
- Use that version of Electron to create a app in `<out>/<appname>-<platform>-<arch>` *(this can be customized via an optional flag)*

For details on the optional flags, run `electron-packager --help` or see [usage.txt](https://github.com/maxogden/electron-packager/blob/master/usage.txt).

If appname is omitted, this will use the name specified by "productName" or "name" in the nearest package.json. If version is omitted, it will use the version of the nearest installed electron-prebuilt dependency.

You should be able to launch the app on the platform you built for. If not, check your settings and try again.

**Be careful** not to include `node_modules` you don't want into your final app. `electron-packager`, `electron-prebuilt` and `.git` will be ignored by default. You can use `--ignore` to ignore files and folders via a regular expression. For example, `--ignore=node_modules/electron-packager` or `--ignore="node_modules/(electron-packager|electron-prebuilt)"`.

#### Example

Given the app `FooBar` with the following file structure:

```
foobar
├─package.json
└┬src
 ├─index.html
 ├─script.js
 └─style.css
```

When one runs the following command for the first time in the `foobar` directory:

```
electron-packager . FooBar --platform=darwin --arch=x64 --version=0.28.2
```

`electron-packager` will do the following:

* download Electron 0.28.2 for OS X on x64 (and cache the download in `~/.electron`)
* build the OS X `FooBar.app`
* place `FooBar.app` in `foobar/FooBar-darwin-x64/` (since an `out` directory was not specified)

The file structure now looks like:

```
foobar
├┬FooBar-darwin-x64
│├┬FooBar.app
││└[…Mac app contents…]
│├─LICENSE
│└─version
├─package.json
└┬src
 ├─index.html
 ├─script.js
 └─style.css
```

The `FooBar.app` folder generated can be executed by a system running OS X, which will start the packaged Electron app.

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

  Not required if `all` is used.
  The non-`all` values correspond to the architecture names used by [Electron releases](https://github.com/atom/electron/releases).

`dir` - *String*

  The source directory.

`platform` - *String*

  Allowed values: *linux, win32, darwin, all*

  Not required if `all` is used.
  Arbitrary combinations of individual platforms are also supported via a comma-delimited string or array of strings.
  The non-`all` values correspond to the platform names used by [Electron releases](https://github.com/atom/electron/releases).

**Optional**

`all` - *Boolean*

  When `true`, sets both `arch` and `platform` to `all`.

`app-bundle-id` - *String*

  The bundle identifier to use in the application's plist (OS X only).

`app-category-type` - *String*

  The application category type, as shown in the Finder via *View -> Arrange by Application Category* when viewing the Applications directory (OS X only).

  For example, `app-category-type=public.app-category.developer-tools` will set the application category to *Developer Tools*.

  Valid values are listed in [Apple's documentation](https://developer.apple.com/library/ios/documentation/General/Reference/InfoPlistKeyReference/Articles/LaunchServicesKeys.html#//apple_ref/doc/uid/TP40009250-SW8).

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

`helper-bundle-id` - *String*

  The bundle identifier to use in the application helper's plist (OS X only).

`icon` - *String*

  Currently you must look for conversion tools in order to supply an icon in the format required by the platform:

  - OS X: `.icns`
  - Windows: `.ico` ([See below](#building-windows-apps-from-non-windows-platforms) for details on non-Windows platforms)
  - Linux: this option is not required, as the dock/window list icon is set via [the icon option in the BrowserWindow contructor](http://electron.atom.io/docs/v0.30.0/api/browser-window/#new-browserwindow-options). Setting the icon in the file manager is not currently supported.

If the file extension is omitted, it is auto-completed to the correct extension based on the platform, including when `--platform=all` is in effect.

`ignore` - *RegExp*

  A pattern which specifies which files to ignore when copying files to create the package(s).

`name` - *String*
  The application name. If omitted, it will use the "productName" or "name" of the nearest package.json.

`out` - *String*

  The base directory where the finished package(s) are created. Defaults to the current working directory.

`overwrite` - *Boolean*

  Whether to replace an already existing output directory for a given platform (`true`) or skip recreating it (`false`). Defaults to `false`.

`prune` - *Boolean*

  Runs [`npm prune --production`](https://docs.npmjs.com/cli/prune) before starting to package the app.

`sign` - *String*

  The identity used when signing the package via `codesign`. (Only for the OS X target platform, when XCode is present on the build platform.)

`strict-ssl` - *Boolean*

  Whether SSL certificates are required to be valid when downloading Electron. **Defaults to `true`**.

`version` - *String*

  The Electron version with which the app is built (without the leading 'v') - for example, [`0.33.9`](https://github.com/atom/electron/releases/tag/v0.33.9). See [Electron releases](https://github.com/atom/electron/releases) for valid versions. If omitted, it will use the version of the nearest local installation of electron-prebuilt.

`version-string` - *Object*

  Object hash of application metadata to embed into the executable (Windows only):
  - `CompanyName`
  - `LegalCopyright`
  - `FileDescription`
  - `OriginalFilename`
  - `FileVersion` (**deprecated** and will be removed in a future major version, please use the top-level `build-version` parameter instead)
  - `ProductVersion` (**deprecated** and will be removed in a future major version, please use the top-level `app-version` parameter instead)
  - `ProductName`
  - `InternalName`

##### callback

`err` - *Error*

  Contains errors, if any.

`appPath` - *String*

  Path to the newly created application.

## Building Windows apps from non-Windows platforms

Building an Electron app for the Windows platform with a custom icon requires editing the `Electron.exe` file. Currently, electron-packager uses [node-rcedit](https://github.com/atom/node-rcedit) to accomplish this. A Windows executable is bundled in that node package and needs to be run in order for this functionality to work, so on non-Windows platforms, [Wine](https://www.winehq.org/) needs to be installed. On OS X, it is installable via [Homebrew](http://brew.sh/).

## Related

- [electron-builder](https://www.npmjs.com/package/electron-builder) - for creating installer wizards
- [grunt-electron](https://github.com/sindresorhus/grunt-electron) - grunt plugin for electron-packager
- [electron-packager-interactive](https://github.com/Urucas/electron-packager-interactive) - an interactive CLI for electron-packager
