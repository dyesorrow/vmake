#!/bin/bash

cwd=`pwd`
# 构建镜像
if [ "$(sudo docker images -q ubuntu)" == "" ]; then 
    sudo mkdir -p /tmp/vmake-docker
    cd /tmp/vmake-docker
    wget https://github.com/dyesorrow/vmake/raw/master/docker/Dockerfile
    sudo docker build -f Dockerfile -t vmake .
fi
# 删除存在的容器
if [ "$(sudo docker ps -a -q -f name=vmake)" != "" ]; then 
    sudo docker rm -f vmake > /dev/null
fi
cd $cwd
sudo docker run --rm -it -v $(pwd):/data vmake vmake $*