# Contributing to electron-packager

electron-packager is a community-driven project. As such, we welcome and encourage all sorts of
contributions. They include, but are not limited to:

- Constructive feedback
- Questions about usage
- [Bug reports / technical issues](#before-opening-bug-reportstechnical-issues)
- Documentation changes
- Feature requests
- [Pull requests](#filing-pull-requests)

We strongly suggest that before filing an issue, you search through the existing issues to see
if it has already been filed by someone else.


## Before opening bug reports/technical issues

### Debugging

One way to troubleshoot potential problems is to set the `DEBUG` environment variable before
calling electron-packager. This will print debug information from the specified modules. The
value of the environment variable is a comma-separated list of modules which support this logging
feature. Known modules include:

* `electron-download`
* `extract-zip`

## Contribution suggestions

We use the label [`help wanted`](https://github.com/electron-userland/electron-packager/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) in the issue tracker to denote fairly-well-scoped-out bugs or feature requests that the community can pick up and work on. If any of those labeled issues do not have enough information, please feel free to ask constructive questions. (This applies to any open issue.)

## Filing Pull Requests

Here are some things to keep in mind as you file pull requests to fix bugs, add new features, etc.:

* Travis CI is used to make sure that the project builds packages as expected on the supported
  platforms, using supported Node.js versions.
* Unless it's impractical, please write tests for your changes. This will help us so that we can
  spot regressions much easier.
* If your PR changes the behavior of an existing feature, or adds a new feature, please add/edit
  the package's documentation. Files that will likely need to be updated include `readme.md`,
  `docs/api.md`, and `usage.txt`.
* This project uses the [JavaScript Standard Style](https://www.npmjs.com/package/standard) as a
  coding convention. CI will fail if the PR does not conform to this standard.
* One of the philosophies of the project is to keep the code base as small as possible. If you are
  adding a new feature, think about whether it is appropriate to go into a separate Node module,
  and then be integrated into this project.
* If you are contributing a nontrivial change, please add an entry to `NEWS.md`. The format is
  similar to the one described at [Keep a Changelog](http://keepachangelog.com/).
* Please make sure your commits are rebased onto the latest commit in the master branch, and that
  you limit/squash the number of commits created to a "feature"-level. For instance:

bad:

```
commit 1: add foo option
commit 2: standardize code
commit 3: add test
commit 4: add docs
commit 5: add bar option
commit 6: add test + docs
```

good:

```
commit 1: add foo option
commit 2: add bar option
```

If you are continuing the work of another person's PR and need to rebase/squash, please retain the
attribution of the original author(s) and continue the work in subsequent commits.

## For Collaborators

Make sure to get a `:thumbsup:`, `+1` or `LGTM` from another collaborator before merging a PR.

Release process:

- if you aren't sure if a release should happen, open an issue
- make sure that `NEWS.md` is up to date
- make sure the tests pass
- `npm version <major|minor|patch>`
- `git push && git push --tags` (or `git push` with `git config --global push.followTags true` on latest git)
- `npm publish`
