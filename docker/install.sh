#!/bin/bash
sudo wget https://github.com/dyesorrow/vmake/raw/master/docker/vmake.sh -O /usr/local/bin/vmake
sudo chmod +x /usr/local/bin/vmake
echo "vmake download success. container build is as flowers"
vmake
