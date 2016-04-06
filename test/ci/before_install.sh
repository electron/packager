#!/bin/bash -xe
# -*- coding: utf-8 -*-

case "$TRAVIS_OS_NAME" in
  "linux")
    sudo dpkg --add-architecture i386
    # Chrome source does not work because they no longer support i386
    sudo rm /etc/apt/sources.list.d/google-chrome.list*
    sudo apt-get update
    sudo apt-get install --no-install-recommends --yes wine1.6 winetricks
    # 20140817
    wget -q https://raw.githubusercontent.com/Winetricks/winetricks/fa9e42955dbdf780240dedf9057295264fddd98f/src/winetricks
    chmod +x winetricks
    ./winetricks --version
    ./winetricks -q vcrun2013
    ;;
esac
