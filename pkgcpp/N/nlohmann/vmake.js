vmake.tasks.nlohmann = async () => {
    const fs = require("fs");
    const inquirer = require('inquirer');
    const adm_zip = require("adm-zip");

    const target = "nlohmann";

    if (fs.existsSync(target)) {
        vmake.warn("Target [%s] dir exist!", target);
        let answer = await inquirer.prompt({ message: "continue and delete this dir (y/n)", name: "input" });
        if (answer.input.toUpperCase() != "Y") {
            return;
        }
    }

    vmake.rm(target);
    vmake.mkdirs(target);
    process.chdir(target);

    vmake.info("[do download]");
    await vmake.wget("https://github.com/nlohmann/json/releases/download/v3.10.5/include.zip", "./include.zip", {
        proxy:{
            protocol: "http",
            host: "127.0.0.1",
            port: 1080
        }
    });

    const unzip = new adm_zip("include.zip");
    vmake.mkdirs("nlohmann");
    unzip.extractAllTo("nlohmann");

    vmake.info("[do publish]");
    vmake.mkdirs("publish");
    vmake.run("vmake publish", "publish");
    vmake.run("cp nlohmann/include/** publish/include -r");

    fs.writeFileSync("publish/vmakepkg.json", JSON.stringify({
        "name": "nlohmann",
        "version": "3.10.5",
        "repo": vmake.get_config("repo", "http://localhost:19901/vmake-repo")
    }, null, 4));
    vmake.run("vmake publish", "publish");
}