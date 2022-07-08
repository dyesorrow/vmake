#!/usr/bin/env node

require("./src/vmake_global.js");
require("./src/vmake_net.js");
require("./src/vmake_log.js");
require("./src/vmake_config.js");
require("./src/vmake_os.js");
require("./src/vmake_util.js");
require("./src/vmake_cpp.js");

require("./src/task_help.js");
require("./src/task_example.js");
require("./src/task_init.js");
require("./src/task_publish.js");
require("./src/task_update.js");


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

function run() {
    try {
        if (vmake.args.length != 0 && vmake.task[vmake.args[0]]) {
            vmake.task[vmake.args[0]](); // 优先尝试执行内置任务. 内置任务不需要查找 vmake.js 文件
            return;
        }

        // 加载用户自定义任务
        find_vamkejs(process.cwd(), (vmakejs) => {
            require(vmakejs);
            process.chdir(path.dirname(vmakejs)); // 更改主工作目录
        });

        const inner_tasks = {
            "help": true,
            "publish": true,
            "init": true,
            "update": true,
            "example": true,
        };
        let user_tasks = [];
        for (const key in vmake.task) {
            if (!inner_tasks[key]) {
                user_tasks.push(key);
            }
        };

        if (vmake.args.length != 0) {
            if (vmake.task[vmake.args[0]]) {
                vmake.task[vmake.args[0]]();
            } else {
                vmake.error("没有找到任务, 任务列表如下: \n  " + Object.keys(inner_tasks).join("\n  ") + "\n\n  " + user_tasks.join("\n  "));
            }
            return;
        } else {
            if (user_tasks.length == 0) {
                vmake.task.help();
            } else {
                vmake.task[user_tasks[0]](); // 默认使用第一个用户任务
            }
        }
    } catch (error) {
        if (error instanceof RangeError) {
            vmake.error("%s", "No vmake project. Not find vmake.js!");
            vmake.task.help();
        } else {
            vmake.error("%s", error);
        }
    }
}

run();






