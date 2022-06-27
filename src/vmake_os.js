const execAsync = require("child_process").exec;
const nodeSpawn = require("child_process").spawnSync;
const fs = require("fs");
const crypto = require("crypto");
const Path = require("path");

vmake.mkdirs = function (dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (vmake.mkdirs(Path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
};

/**
 * 实时输出，可以显示颜色
 * @param {*} command 
 * @param {*} cwd 
 */
vmake.run = function (command, cwd) {
    let ret = nodeSpawn(command, {
        stdio: "inherit",
        shell: true, // 解决 console.log 颜色不显示的问题
        cwd,
    });
    if (ret.status != 0) {
        throw "Fail: " + command;
    }
};

/**
 * 结果全部出来后进行输出。无法显示颜色
 * @param {*} command 
 * @param {*} cwd 
 * @returns 
 */
vmake.exec = function (command, cwd) {
    return new Promise((resolve, reject) => {
        execAsync(command, {
            stdio: "pipe",
            cwd
        }, (error, stdout, stderr) => {
            process.stdout.write(stdout);
            process.stderr.write(stderr);
            if (error) {
                reject(`Fail: ${command}`);
                return;
            }
            resolve();
        });
    });
};

vmake.run_multi_process = function (task_size, process_limit, todo) {
    let wait_end = 0;
    let task_at = 0;
    let rejected = false;

    let run_process = function (resolve, reject) {
        if (task_at < task_size) {
            let to_run = process_limit - wait_end;
            if (to_run > task_size - task_at) {
                to_run = task_size - task_at;
            }
            for (let i = 0; i < to_run; i++) {
                const at = task_at;

                new Promise(async (res, rej) => {
                    try {
                        await todo(at);
                    } catch (error) {
                        if (!rejected) {
                            rejected = true;
                            reject(error);
                        }
                        res();
                        return;
                    }
                    wait_end--;
                    res();
                    run_process(resolve, reject);
                    return;
                });

                task_at++;
                wait_end++;
            }
        }
        if (wait_end == 0) {
            resolve();
        }
    };
    return new Promise(run_process);
};

vmake.md5sum = function (file) {
    if (!fs.existsSync(file)) {
        return "not exist";
    }
    const buffer = fs.readFileSync(file);
    const hash = crypto.createHash("md5");
    hash.update(buffer, "utf8");
    const md5 = hash.digest("hex");
    return md5;
};

vmake.dir_md5sum = function (...dir_list) {
    let data = {};
    function dir_md5_impl(dir) {
        if (!fs.existsSync(dir)) {
            data[dir] = vmake.md5sum(dir); // 没有的也给个默认值
            return;
        }
        if (fs.statSync(dir).isDirectory()) {
            for (const it of fs.readdirSync(dir)) {
                dir_md5_impl(dir + "/" + it);
            }
        } else {
            data[dir] = vmake.md5sum(dir);
        }
    }
    for (const it of dir_list) {
        dir_md5_impl(it);
    }
    return data;
};

vmake.copy = function (source, dest, filter) {
    function do_copy(fsource, fdest) {
        if (!fs.existsSync(fsource)) {
            vmake.error("file not exist: %s", fsource);
            return;
        }
        let stat = fs.statSync(fsource);
        if (stat.isDirectory()) {
            if (!fs.existsSync(fdest)) {
                fs.mkdirSync(fdest);
            }
            if (fsource.endsWith("/")) {
                fsource = fsource.substring(0, fsource.length - 1);
            }
            for (const it of fs.readdirSync(fsource)) {
                do_copy(fsource + "/" + it, fdest + "/" + it);
            }
        } else {
            if (!fs.existsSync(Path.dirname(fdest))) {
                vmake.mkdirs(Path.dirname(fdest));
            }
            if (filter && !filter(fsource, fdest)) {
                return;
            }
            if (vmake.md5sum(fsource) == vmake.md5sum(fdest)) {
                return;
            }
            fs.copyFileSync(fsource, fdest);
        }
    }
    do_copy(source, dest);
};

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
};
