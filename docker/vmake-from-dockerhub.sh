#!/bin/bash
sudo docker run --rm -it -v $(pwd):/data dyesorrow/vmake vmake $*

