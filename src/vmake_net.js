const http = require('http');
const https = require("https");
const fs = require('fs');
const Path = require('path');
const wget = require('wget-improved');
const fetch = require('node-fetch');

vmake.download = async function (uri, dest) {
    vmake.mkdirs(Path.dirname(dest));
    await vmake.wget(uri, dest);
};

vmake.upload = async function (local, remote) {
    try {
        vmake.info("upload: %s > %s", local, remote);
        let readStream = fs.createReadStream(local);
        await fetch(remote, {
            method: "PUT",
            body: readStream
        });
    } catch (error) {
        console.log(error);
        process.exit(-1);
    }
};

vmake.get_content = function (uri) {
    return new Promise((resolve, reject) => {
        let content = "";
        let httpx = http;
        if (uri.startsWith("https")) {
            httpx = https;
        }
        httpx.get(uri, (res) => {
            if (res.statusCode !== 200) {
                reject(`Get content error, code ${res.statusCode}: ${uri}`);
                return;
            }
            res.on('data', (data) => {
                content += `${data}`;
            });
            res.on('end', () => {
                resolve(content);
            });
        }).on("error", (error) => {
            reject(`${error}: ${uri}`);
        });
    });
};

vmake.wget = function (src, dist, option) {
    return new Promise((resolve, reject) => {
        let dir = Path.dirname(dist);
        if(!fs.existsSync(dir)){
            vmake.mkdirs(dir);
        }
        let download = wget.download(src, dist, option);
        let process_bar = vmake.process_bar(src + ": ");
        download.on('error', function (err) {
            process_bar.end();
            reject(err);
        });
        download.on('start', function (fileSize) {
            process_bar.start();
        });
        download.on('end', function (output) {
            process_bar.end();
            resolve();
        });
        download.on('progress', function (progress) {
            if (typeof progress === 'number') {
                process_bar.set_process(progress);
            }
        });
    });
};