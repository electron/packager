# electron-packager API

Short example:

```javascript
var packager = require('electron-packager')
packager(options, function done_callback (err, appPaths) { /* … */ })
```

## `options`

### Required

#### `arch`

_String_

Allowed values: `ia32`, `x64`, `all`

The target system architecture(s) to build for. Not required if the [`all`](#all) option is set. If `arch` is set to `all`, all supported architectures for the target platforms specified by [`platform`](#platform) will be built. Arbitrary combinations of individual architectures are also supported via a comma-delimited string or array of strings. The non-`all` values correspond to the architecture names used by [Electron releases].

#### `dir`

_String_

The source directory.

#### `platform`

_String_

Allowed values: `linux`, `win32`, `darwin`, `mas`, `all`

The target platform(s) to build for. Not required if the [`all`](#all) option is set. If `platform` is set to `all`, all [supported target platforms](#supported-platforms) for the target architectures specified by [`arch`](#arch) will be built. Arbitrary combinations of individual platforms are also supported via a comma-delimited string or array of strings. The non-`all` values correspond to the platform names used by [Electron releases].

### Optional

#### All Platforms

##### `all`

_Boolean_

When `true`, sets both [`arch`](#arch) and [`platform`](#platform) to `all`.

##### `app-copyright`

_String_

The human-readable copyright line for the app. Maps to the `LegalCopyright` metadata property on Windows, and `NSHumanReadableCopyright` on OS X.

##### `app-version`

_String_

The release version of the application. Maps to the `ProductVersion` metadata property on Windows, and `CFBundleShortVersionString` on OS X.

##### `asar`

_Boolean_ (default: `false`)

Whether to package the application's source code into an archive, using [Electron's archive format](https://github.com/electron/asar). Reasons why you may want to enable this feature are described in [an application packaging tutorial in Electron's documentation](http://electron.atom.io/docs/v0.36.0/tutorial/application-packaging/).

##### `asar-unpack`

_String_

A [glob expression](https://github.com/isaacs/minimatch#features), when specified, unpacks the file with matching names to the `app.asar.unpacked` directory.

##### `asar-unpack-dir`

_String_

Unpacks the dir to `app.asar.unpacked` directory whose names exactly or pattern match this string. The `asar-unpack-dir` is relative to `dir`.

Some examples:

- `asar-unpack-dir=sub_dir` will unpack the directory `/<dir>/sub_dir`
- `asar-unpack-dir=**/{sub_dir1/sub_sub_dir,sub_dir2}/*` will unpack the directories `/<dir>/sub_dir1/sub_sub_dir` and `/<dir>/sub_dir2`, but it will note include their subdirectories.
- `asar-unpack-dir=**/{sub_dir1/sub_sub_dir,sub_dir2}/**` will unpack the subdirectories of the directories `/<dir>/sub_dir1/sub_sub_dir` and `/<dir>/sub_dir2`.
- `asar-unpack-dir=**/{sub_dir1/sub_sub_dir,sub_dir2}/**/*` will unpack the directories `/<dir>/sub_dir1/sub_sub_dir` and `/<dir>/sub_dir2` and their subdirectories.

##### `build-version`

_String_

The build version of the application. Maps to the `FileVersion` metadata property on Windows, and `CFBundleVersion` on OS X.

##### `cache`

_String_ (default: `$HOME/.electron`) (**deprecated** and will be removed in a future major version, please use the [`download.cache`](#download) parameter instead)

The directory where prebuilt, pre-packaged Electron downloads are cached.

##### `download`

_Object_

If present, passes custom options to [`electron-download`](https://www.npmjs.com/package/electron-download) (see the link for more detailed option descriptions and the defaults). Supported parameters include, but are not limited to:

- `cache` (_String_): The directory where prebuilt, pre-packaged Electron downloads are cached.
- `mirror` (_String_): The URL to override the default Electron download location.
- `strictSSL` (_Boolean_ - default: `true`): Whether SSL certificates are required to be valid when downloading Electron.

##### `icon`

_String_

Currently you must look for conversion tools in order to supply an icon in the format required by the platform:

- OS X: `.icns`
- Windows: `.ico` ([See the readme](https://github.com/electron-userland/electron-packager#building-windows-apps-from-non-windows-platforms) for details on non-Windows platforms)
- Linux: this option is not required, as the dock/window list icon is set via [the icon option in the BrowserWindow constructor](http://electron.atom.io/docs/v0.30.0/api/browser-window/#new-browserwindow-options). Setting the icon in the file manager is not currently supported.

If the file extension is omitted, it is auto-completed to the correct extension based on the platform, including when [`--platform=all`](#platform) is in effect.

##### `ignore`

_RegExp_ or _Function_

A pattern which specifies which files to ignore when copying files to create the package(s). The [`out`](#out) directory is ignored by default, along with the `electron-prebuilt` and `electron-packager` Node modules, the `.git` directory, and `node_modules/.bin`. Alternatively, this can be a predicate function that, given the file path, returns true if the file should be ignored or false if the file should be kept.

##### `name`

_String_

The application name. If omitted, it will use the `productName` or `name` value of the nearest `package.json`.

##### `out`

_String_ (default: current working directory)

The base directory where the finished package(s) are created.

##### `overwrite`

_Boolean_ (default: `false`)

Whether to replace an already existing output directory for a given platform (`true`) or skip recreating it (`false`).

##### `prune`

_Boolean_

Runs [`npm prune --production`](https://docs.npmjs.com/cli/prune) before starting to package the app.

##### `strict-ssl`

_Boolean_ (**default: `true`**) (**deprecated** and will be removed in a future major version, please use the [`download.strictSSL`](#download) parameter instead)

Whether SSL certificates are required to be valid when downloading Electron.

##### `tmpdir`

_String_ or _`false`_ (default: system temp directory)

The base directory to use as a temp directory. Set to `false` to disable use of a temporary directory.

##### `version`

_String_

The Electron version with which the app is built (without the leading 'v') - for example, [`0.33.9`](https://github.com/electron/electron/releases/tag/v0.33.9). See [Electron releases] for valid versions. If omitted, it will use the version of the nearest local installation of electron-prebuilt.

#### OS X/Mac App Store targets only

##### `app-bundle-id`

_String_

The bundle identifier to use in the application's plist.

##### `app-category-type`

_String_

The application category type, as shown in the Finder via _View → Arrange by Application Category_ when viewing the Applications directory.

For example, `app-category-type=public.app-category.developer-tools` will set the application category to _Developer Tools_.

Valid values are listed in [Apple's documentation](https://developer.apple.com/library/ios/documentation/General/Reference/InfoPlistKeyReference/Articles/LaunchServicesKeys.html#//apple_ref/doc/uid/TP40009250-SW8).

##### `extend-info`

_String_

Filename of a plist file; the contents are added to the app's plist. Entries in `extend-info` override entries in the base plist file supplied by `electron-prebuilt`, but are overridden by other explicit arguments such as [`app-version`](#app-version) or [`app-bundle-id`](#app-bundle-id).

##### `extra-resource`

_String_ or _Array_

Filename of a file to be copied directly into the app's `Contents/Resources` directory.

##### `helper-bundle-id`

_String_

The bundle identifier to use in the application helper's plist.

##### `osx-sign`

_Object_ or _`true`_

If present, signs OS X target apps when the host platform is OS X and XCode is installed. When the value is `true`, pass default configuration to the signing module. The configuration values listed below can be customized when the value is an `Object`. See [electron-osx-sign](https://www.npmjs.com/package/electron-osx-sign#opts) for more detailed option descriptions and the defaults.

- `identity` (_String_): The identity used when signing the package via `codesign`.
- `entitlements` (_String_): The path to the 'parent' entitlements.
- `entitlements-inherit` (_String_): The path to the 'child' entitlements.

#### Windows targets only

##### `version-string`

_Object_

Object (also known as a "hash") of application metadata to embed into the executable:

- `CompanyName`
- `FileDescription`
- `OriginalFilename`
- `ProductName`
- `InternalName`

## callback

### `err`

_Error_ (or _Array_, in the case of an `copy` error)

Contains errors, if any.

### `appPaths`

_Array_ of _String_s

Paths to the newly created application bundles.

[electron releases]: https://github.com/electron/electron/releases
