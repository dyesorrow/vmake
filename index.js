#!/usr/bin/env node

require("./src/vmake_global.js");
require("./src/task_build.js");
require("./src/task_help.js");
require("./src/task_init.js");
require("./src/task_publish.js");

vmake.debug("%s", vmake.args);

try {
    if (vmake.args.length == 0) {
        vmake.tasks.build();
    } else {
        if(vmake.args[0] == "build"){
            vmake.tasks.build(vmake.args[1]);
        }
        else if (vmake.tasks[vmake.args[0]]) {
            vmake.tasks[vmake.args[0]]();
        } else {
            vmake.tasks.build(vmake.args[0]);
        }
    }
} catch (error) {
    if(error instanceof RangeError){
        vmake.error("%s", "No vmake project. Not find vmake.js!");
    }else{
        vmake.error("%s", error);
    }
}



