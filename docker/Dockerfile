FROM ubuntu:20.04
RUN sed -i "s/archive.ubuntu.com/mirrors.163.com/g" /etc/apt/sources.list
RUN sed -i "s/security.ubuntu.com/mirrors.163.com/g" /etc/apt/sources.list
RUN apt update -y
RUN apt install g++ wget curl unzip -y
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt install nodejs -y
RUN mkdir -p /vmake && cd /vmake && wget https://github.com/dyesorrow/vmake/archive/refs/heads/master.zip
RUN cd /vmake && unzip master.zip && cd vmake-master && npm install && npm install -g .
WORKDIR /data
CMD vmake