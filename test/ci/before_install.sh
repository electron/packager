#!/bin/bash -xe
# -*- coding: utf-8 -*-

case "$(uname -s)" in
  "Linux")
    sudo dpkg --add-architecture i386
    sudo apt-get update
    sudo apt-get install -y wine
    ;;
  "Darwin")
    "$(dirname $0)"/codesign/import-testing-cert-ci.sh
    brew cask install xquartz wine-stable
    # Setup ~/.wine by running a command
    WINEDEBUG=warn+all wine hostname
    ;;
esac
