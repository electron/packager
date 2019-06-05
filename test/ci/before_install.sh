#!/bin/bash -xe
# -*- coding: utf-8 -*-

case "$TRAVIS_OS_NAME" in
  "linux")
    sudo dpkg --add-architecture i386
    sudo apt-get update
    sudo apt-get install -y wine1.6
    ;;
  "osx")
    "$(dirname $0)"/codesign/import-testing-cert-ci.sh
    npm install wine-darwin@1.9.17-1
    # Setup ~/.wine by running a command
    ./node_modules/.bin/wine hostname
    ;;
esac
