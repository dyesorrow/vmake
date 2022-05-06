const fs = require('fs');

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