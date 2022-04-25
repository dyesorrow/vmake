#!/usr/bin/env node
const fs = require('fs');
const printf = require("printf");


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

require("./src/vmake_util.js");
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
            vmake.tasks[vmake.args[0]](vmake.args[1]);
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



