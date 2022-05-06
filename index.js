#!/usr/bin/env node

require("./src/vmake_global.js");
require("./src/task_build.js");
require("./src/task_help.js");
require("./src/task_init.js");
require("./src/task_publish.js");

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
    })
    if (vmake.args.length == 0) {
        vmake.tasks.help();
    }
    else {
        if (vmake.tasks[vmake.args[0]]) {
            vmake.tasks[vmake.args[0]]();
        } else {
            const inner_tasks = {
                "help": true,
                "publish": true,
                "init": true,
            }
            for (const key in vmake.tasks) {
                if (!inner_tasks[key]) {
                    vmake.tasks[key]();
                }
            }
        }
    }
} catch (error) {
    if (error instanceof RangeError) {
        vmake.error("%s", "No vmake project. Not find vmake.js!");
        vmake.tasks.help();
    } else {
        vmake.error("%s", error);
    }
}



