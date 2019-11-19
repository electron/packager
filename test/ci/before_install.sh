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
    ;;
esac
