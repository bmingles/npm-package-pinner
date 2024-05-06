# Npm Pinner

This script traverses the dependency tree of a given npm package name + version
and determines the latest dependency versions that were available at the time.
This can be used to pin dependency versions to a point in time for dependable
downgrading of a package.

## Usage

`npm start <package-name> <package-version>`

You can optionally set environment variables `NPM_PINNER_PACKAGE_NAME` and `NPM_PINNER_PACKAGE_VERSION` instead of passing them into `npm start`

This will generate 2 files the `out` directory.

- package-info.json - name, version, time info for each package
- pinned-versions.json - map of name to version to pin

## Debugging

The `launch.json` config requires a `.env.development` file containing `NPM_PINNER_PACKAGE_NAME` and `NPM_PINNER_PACKAGE_VERSION` environment variables.
