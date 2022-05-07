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


vmake.task.publish = async function () {
    vmake.debug("publish");

    let is_init = false;
    if (!fs.existsSync("./vmakepkg.json")) {
        fs.writeFileSync("vmakepkg.json", JSON.stringify({
            name: "",
            version: "1.0.0",
            repo: vmake.get_config("repo", "http://localhost:19901/vmake-repo")
        }, null, 4));
        is_init = true;
        vmake.info("init vmakepkg.json");
    }

    const init_dir = {
        "include": "init dir ./include",
        "lib": "init dir ./lib",
        "bin": "init dir ./bin, push resource files, dlls here",
        "src": "init dir ./src"
    };

    for (const dir in init_dir) {
        if (!fs.existsSync("./" + dir + "/")) {
            vmake.mkdirs(dir);
            is_init = true;
            vmake.info(init_dir[dir]);
        }
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

        vmake.info("[0%] the configuration is as follows: ");
        console.log(config);

        vmake.mkdirs(".publish");
        try {
            fs.rmSync(".publish/dest.zip");
            fs.rmSync(".publish/md5.txt");
            fs.rmSync(".publish/files.md5");
        } catch (error) {
        }

        fs.writeFileSync(".publish/files.md5", JSON.stringify(dir_md5("lib", "include", "bin", "src"), null, 4));

        const zip = new adm_zip();
        zip.addLocalFolder("lib", "lib");
        zip.addLocalFolder("include", "include");
        zip.addLocalFolder("src", "src");
        zip.addLocalFolder("bin", "bin");
        zip.addLocalFile("readme.md");
        zip.writeZip(".publish/dest.zip");

        fs.writeFileSync(".publish/md5.txt", JSON.stringify(dir_md5("lib", "include", "bin", ".publish/dest.zip"), null, 4));

        let pre = `${config.repo}/${config.name}/${os.platform()}-${config.version}`;
        vmake.info("[50%] upload >>> %s", pre);

        await vmake.upload("./.publish/dest.zip", `${pre}.zip`);
        await vmake.upload("./.publish/md5.txt", `${pre}.md5`);
        await vmake.upload("./readme.md", `${config.repo}/${config.name}/readme.md`);

        vmake.success("%s", "[100%] success!");
    } catch (error) {
        console.log(error);
    }
};