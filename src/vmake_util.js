const http = require('http');
const nodeSpawn = require('child_process').spawnSync;
const fs = require('fs');
const crypto = require('crypto');
const Path = require('path');
const printf = require("printf");

function run(command) {
    let ret = nodeSpawn(command, {
        stdio: 'inherit',
        shell: true,  // 解决 console.log 颜色不显示的问题
    });
    if (ret.status != 0) {
        throw "failed: " + command;
    }
}

function mkdirs(dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirs(Path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

function download(uri, dest) {
    mkdirs(Path.dirname(dest));
    return new Promise((resolve, reject) => {
        vmake.info("%s", `download: ${uri} -> ${dest}`);
        const file = fs.createWriteStream(dest);
        http.get(uri, (res) => {
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
}

function get_content(uri) {
    return new Promise((resolve, reject) => {
        let content = "";
        http.get(uri, (res) => {
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

function md5sum(file) {
    const buffer = fs.readFileSync(file);
    const hash = crypto.createHash('md5');
    hash.update(buffer, 'utf8');
    const md5 = hash.digest('hex');
    return md5;
}


function copy(source, dest, check_md5) {
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
            fs.copyFileSync(fsource, fdest);
        }
    }
    do_copy(source, dest);
}

function rm(path) {
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

function time_format(time) {
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

function global_config(name, default_val) {
    const USER_HOME = process.env.HOME || process.env.USERPROFILE;
    let config = {};
    if (fs.existsSync(USER_HOME + "/.vmake")) {
        config = JSON.parse(fs.readFileSync(USER_HOME + "/.vmake").toString());
    }
    if (!config[name]) {
        config[name] = default_val;
        fs.writeFileSync(USER_HOME + "/.vmake", JSON.stringify(config, null, 4));
        return default_val;
    } else {
        return config[name];
    }
}

global.vmake = {
    args: process.argv.splice(2),
    tasks: {},
    util: {},
    debug: function (fmt, ...args) {
        if (vmake.global_config("debug", false)) {
            console.log(fmt, ...args);
        }
    },
    info: function (fmt, ...args) {
        console.log(printf("\u001b[38;5;86m" + fmt + "\u001b[0m", ...args));;
    },
    warn: function (fmt, ...args) {
        console.log(printf("\u001b[1;33m" + fmt + "\u001b[0m", ...args));;
    },
    error: function (fmt, ...args) {
        console.log(printf("\u001b[1;31m" + fmt + "\u001b[0m", ...args));;
    },
    success: function (fmt, ...args) {
        console.log(printf("\u001b[1;32m" + fmt + "\u001b[0m", ...args));;
    },
};

vmake.util.get_content = get_content;
vmake.util.time_format = time_format;

vmake.mkdirs = mkdirs;
vmake.download = download;
vmake.md5sum = md5sum;
vmake.run = run;
vmake.copy = copy;
vmake.rm = rm;
vmake.global_config = global_config;




