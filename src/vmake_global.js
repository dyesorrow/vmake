global.vmake = {
    args: process.argv.splice(2),
    task: {},
    config: { wating_load: true },
    module: {
        "inquirer": require('inquirer'),
        "adm-zip": require("adm-zip"),
        "node-fetch": require("node-fetch"),
        "wget-improved": require("wget-improved"),
        "printf": require("printf"),
        "ejs": require("ejs"),
    },
};












