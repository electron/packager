#!/bin/bash -xe
# -*- coding: utf-8 -*-

case "$(uname -s)" in
  "Darwin")
    "$(dirname $0)"/codesign/import-testing-cert-ci.sh
    ;;
esac
