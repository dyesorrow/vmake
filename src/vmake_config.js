const fs = require('fs');

const USER_HOME = process.env.HOME || process.env.USERPROFILE;
let vmake_path = USER_HOME + "/.vmake"

vmake.get_config = function (name, default_val) {

    if (vmake.config.wating_load) {
        let config = {};
        if (fs.existsSync("./.vmake")) {
            vmake_path = "./.vmake";
            config = JSON.parse(fs.readFileSync("./.vmake").toString());
        }
        else if (fs.existsSync(USER_HOME + "/.vmake")) {
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

    if (!vmake.config[name] && default_val) {
        // 有默认配置则写入文件
        vmake.config[name] = default_val;
        fs.writeFileSync(vmake_path, JSON.stringify(vmake.config, null, 4));
        return default_val;
    } else {
        return vmake.config[name];
    }
};

vmake.set_config = function (name, value) {
    vmake.get_config();
    vmake.config[name] = value;
};