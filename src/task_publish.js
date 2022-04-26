const exec = require('child_process').execSync;
const fs = require('fs');
const os = require('os');
const adm_zip = require("adm-zip");


function dir_md5(...dir_list) {
    let data = {};
    function dir_md5_impl(dir) {
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
}


vmake.tasks.publish = function () {
    vmake.debug("publish");

    let is_init = false;
    if (!fs.existsSync("./vmakepkg.json")) {
        // 创建 vmakepkg.json, 并报错
        fs.writeFileSync("vmakepkg.json", JSON.stringify({
            name: "",
            version: "1.0.0",
            repo: vmake.global_config("repo", "http://localhost:19901/vmake-repo")
        }, null, 4));
        is_init = true;
        vmake.info("init vmakepkg.json");
    }

    if (!fs.existsSync("./include/")) {
        vmake.mkdirs("include");
        is_init = true;
        vmake.info("init dir ./include");
    }

    if (!fs.existsSync("./lib/")) {
        vmake.mkdirs("lib");
        is_init = true;
        vmake.info("init dir ./lib");
    }

    if (!fs.existsSync("./bin/")) {
        vmake.mkdirs("bin");
        is_init = true;
        vmake.info("init dir ./bin, push resource files, dlls here");
    }

    if (!fs.existsSync("./readme.md")) {
        fs.writeFileSync("readme.md", "no description");
        vmake.info("init readme.md");
        is_init = true;
    }

    if (is_init) {
        vmake.info("just do init, not publish");
        return;
    }

    try {
        let config = JSON.parse(fs.readFileSync("./vmakepkg.json").toString());
        if (config.name == "") {
            vmake.info("vmakepkg.json is init file, not set name, will not publish");
            return;
        }

        console.log(config);

        vmake.mkdirs(".publish");
        try {
            fs.rmSync(".publish/dest.zip");
            fs.rmSync(".publish/md5.txt");
            fs.rmSync(".publish/files.md5");
        } catch (error) {
        }

        fs.writeFileSync(".publish/files.md5", JSON.stringify(dir_md5("lib", "include", "bin"), null, 4));

        const zip = new adm_zip();
        zip.addLocalFolder("lib", "lib");
        zip.addLocalFolder("include", "include");
        zip.addLocalFolder("bin", "bin");
        zip.addLocalFile("readme.md");
        zip.writeZip(".publish/dest.zip");

        fs.writeFileSync(".publish/md5.txt", JSON.stringify(dir_md5("lib", "include", "bin", ".publish/dest.zip"), null, 4));
        let pre = `${config.repo}/${config.name}/${os.platform()}-${config.version}`;
        console.log("upload >>> ", pre);
        exec(`curl -X PUT -T "./.publish/dest.zip" "${pre}.zip"`);
        exec(`curl -X PUT -T "./.publish/md5.txt" "${pre}.md5"`);
        exec(`curl -X PUT -T "./readme.md" "${config.repo}/${config.name}/readme.md"`);

        vmake.success("%s", "[100%] success!");
    } catch (error) {
        console.log(error);
    }
};