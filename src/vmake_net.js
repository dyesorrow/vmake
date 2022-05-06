const http = require('http');
const https = require("https");
const fs = require('fs');
const Path = require('path');
const wget = require('wget-improved');

vmake.download = function (uri, dest) {
    vmake.mkdirs(Path.dirname(dest));
    return new Promise((resolve, reject) => {
        vmake.info("%s", `download: ${uri} -> ${dest}`);
        const file = fs.createWriteStream(dest);

        let httpx = http;
        if (uri.startsWith("https")) {
            httpx = https;
        }

        httpx.get(uri, (res) => {
            if (res.statusCode !== 200) {
                reject(`Download error, code ${res.statusCode}: ${uri}`);
                return;
            }
            res.on('end', () => {
            });
            file.on('finish', () => {
                resolve();
                file.close();
            }).on('error', (err) => {
                fs.unlink(dest);
                reject(err);
            });
            res.pipe(file);
        }).on("error", (error) => {
            reject(`${error}: ${uri}`);
        });
    });
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
        process.exit(1);
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
        let download = wget.download(src, dist, option);
        download.on('error', function (err) {
            console.log(err);
            reject();
        });
        download.on('start', function (fileSize) {
            console.log(fileSize);
        });
        download.on('end', function (output) {
            console.log(output);
            resolve();
        });
        download.on('progress', function (progress) {
            console.log(progress);
        });
    });
};