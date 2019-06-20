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
    brew install wine
    # Setup ~/.wine by running a command
    wine hostname
    if [[ -n "$TRAVIS" ]]; then
        npm install -g yarn
    fi
    ;;
esac
