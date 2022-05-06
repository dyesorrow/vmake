const http = require('http');
const https = require("https")
const nodeSpawn = require('child_process').spawnSync;
const fs = require('fs');
const crypto = require('crypto');
const Path = require('path');
const printf = require("printf");
const wget = require('wget-improved');

global.vmake = {
    args: process.argv.splice(2),
    task: {},
    config: { wating_load: true }
};

vmake.mkdirs = function (dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (vmake.mkdirs(Path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

vmake.download = function (uri, dest) {
    vmake.mkdirs(Path.dirname(dest));
    return new Promise((resolve, reject) => {
        vmake.info("%s", `download: ${uri} -> ${dest}`);
        const file = fs.createWriteStream(dest);

        let httpx = http
        if (uri.startsWith("https")) {
            httpx = https
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

vmake.get_content = function (uri) {
    return new Promise((resolve, reject) => {
        let content = "";

        let httpx = http
        if (uri.startsWith("https")) {
            httpx = https
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
}

vmake.run = function (command, cwd) {
    let ret = nodeSpawn(command, {
        stdio: 'inherit',
        shell: true,  // 解决 console.log 颜色不显示的问题
        cwd
    });
    if (ret.status != 0) {
        throw "failed: " + command;
    }
}

vmake.md5sum = function (file) {
    const buffer = fs.readFileSync(file);
    const hash = crypto.createHash('md5');
    hash.update(buffer, 'utf8');
    const md5 = hash.digest('hex');
    return md5;
}

vmake.copy = function (source, dest, check_md5) {
    function do_copy(fsource, fdest) {
        let stat = fs.statSync(fsource);
        if (stat.isDirectory()) {
            if (!fs.existsSync(fdest)) {
                fs.mkdirSync(fdest);
            }
            for (const it of fs.readdirSync(fsource)) {
                do_copy(fsource + "/" + it, fdest + "/" + it);
            }
        } else {
            if (!fs.existsSync(Path.dirname(fdest))) {
                fs.mkdirSync(Path.dirname(fdest));
            }
            fs.copyFileSync(fsource, fdest);
        }
    }
    do_copy(source, dest);
}

vmake.rm = function (path) {
    function do_rm(dir) {
        if (!fs.existsSync(dir)) {
            return;
        }
        let stat = fs.statSync(dir);
        if (stat.isDirectory()) {
            for (const it of fs.readdirSync(dir)) {
                do_rm(dir + "/" + it);
            }
            fs.rmdirSync(dir);
        } else {
            fs.rmSync(dir);
        }
    }
    do_rm(path);
}

vmake.get_config = function (name, default_val) {
    const USER_HOME = process.env.HOME || process.env.USERPROFILE;

    if (vmake.config.wating_load) {
        let config = {};
        if (fs.existsSync(USER_HOME + "/.vmake")) {
            config = JSON.parse(fs.readFileSync(USER_HOME + "/.vmake").toString());
        }
        vmake.config = config;
        if (vmake.config.wating_load) {
            delete vmake.config.wating_load;
        }
    }

    if (!name) {
        return;
    }

    if (!vmake.config[name]) {
        vmake.config[name] = default_val;
        fs.writeFileSync(USER_HOME + "/.vmake", JSON.stringify(vmake.config, null, 4));
        return default_val;
    } else {
        return vmake.config[name];
    }
}

vmake.set_config = function (name, value) {
    vmake.get_config();
    vmake.config[name] = value;
}

vmake.time_format = function (time) {
    let result = "";
    let unum = [1, 1000, 60, 60, 24, 0x7fffffff];
    let utxt = ["ms", "s", "m", "h", "d"];
    for (let i = 0; i < unum.length - 1; i++) {
        if (time / unum[i + 1] >= 1) {
            result = (time % unum[i + 1]) + utxt[i] + result;
            time = Math.floor(time / unum[i + 1]);
        } else {
            result = time + utxt[i] + result;
            break;
        }
    }
    return result;
}

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
}

vmake.debug = function (fmt, ...args) {
    if (vmake.get_config("debug", false)) {
        console.log(fmt, ...args);
    }
}

vmake.info = function (fmt, ...args) {
    console.log(printf("\u001b[38;5;86m" + fmt + "\u001b[0m", ...args));;
}

vmake.warn = function (fmt, ...args) {
    console.log(printf("\u001b[1;33m" + fmt + "\u001b[0m", ...args));;
}

vmake.error = function (fmt, ...args) {
    console.log(printf("\u001b[1;31m" + fmt + "\u001b[0m", ...args));;
}

vmake.success = function (fmt, ...args) {
    console.log(printf("\u001b[1;32m" + fmt + "\u001b[0m", ...args));;
}







