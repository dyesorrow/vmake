#!/usr/bin/env node

require("./src/vmake_global.js");
require("./src/task_build.js");
require("./src/task_help.js");
require("./src/task_init.js");
require("./src/task_publish.js");

const path = require('path');
const fs = require('fs');

vmake.debug("%s", vmake.args);

function find_vamkejs(dir, todo) {
    let file = path.join(dir, "vmake.js");
    if (fs.existsSync(file)) {
        todo(file);
    } else {
        find_vamkejs(path.dirname(dir), todo);
    }
}

try {
    find_vamkejs(process.cwd(), (vmakejs) => {
        process.chdir(path.dirname(vmakejs)); // 更改主工作目录
        require(vmakejs);
    });


    if (vmake.args.length == 0 || !vmake.task[vmake.args[0]]) {
        const inner_tasks = {
            "help": true,
            "publish": true,
            "init": true,
        };
        let find = false;
        for (const key in vmake.task) {
            if (!inner_tasks[key]) {
                vmake.task[key]();
                find = true;
                break;
            }
        }
        if (!find) {
            vmake.task.help();
        }
    }
    else {
        vmake.task[vmake.args[0]]();
    }
} catch (error) {
    if (error instanceof RangeError) {
        vmake.error("%s", "No vmake project. Not find vmake.js!");
        vmake.task.help();
    } else {
        vmake.error("%s", error);
    }
}



