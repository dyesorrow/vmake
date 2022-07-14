const fs = require('fs');
const os = require('os');
const adm_zip = require("adm-zip");

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
        vmake.info("添加 vmakepkg.json");
    }

    const init_dir = {
        "include": "添加目录 ./include",
        "lib": "添加目录 ./lib",
        "bin": "添加目录 ./bin, 可以存放资源文件，如dll",
        "src": "添加目录 ./src"
    };

    for (const dir in init_dir) {
        if (!fs.existsSync("./" + dir + "/")) {
            vmake.mkdirs(dir);
            is_init = true;
            vmake.info(init_dir[dir]);
        }
    }

    if (!fs.existsSync("./readme.md")) {
        fs.writeFileSync("readme.md", "没有描述信息");
        vmake.info("添加 readme.md");
        is_init = true;
    }

    if (is_init) {
        vmake.info("初始化完成");
        return;
    }

    try {
        let config = JSON.parse(fs.readFileSync("./vmakepkg.json").toString());
        if (config.name == "") {
            vmake.info("vmakepkg.json 没有设置 name 属性");
            return;
        }

        vmake.info("[0%] 配置如下: ");
        console.log(config);

        vmake.mkdirs(".publish");
        try {
            fs.rmSync(".publish/dest.zip");
            fs.rmSync(".publish/md5.txt");
        } catch (error) {
        }

        const zip = new adm_zip();
        zip.addLocalFolder("lib", "lib");
        zip.addLocalFolder("include", "include");
        zip.addLocalFolder("src", "src");
        zip.addLocalFolder("bin", "bin");
        zip.addLocalFile("readme.md");
        if (fs.existsSync("dependencies.json")) {
            zip.addLocalFile("dependencies.json");
        }
        zip.writeZip(".publish/dest.zip");
        fs.writeFileSync(".publish/md5.txt", JSON.stringify(vmake.dir_md5sum("lib", "include", "bin", "src", "dependencies.json", "readme.md"), null, 4));
        
        let platform = os.platform();
        if(os.platform() == "win32"){
            platform = vmake.gccVersion().target.replaceAll(/[ -]/g, "_").toLocaleLowerCase();
        }
        
        let pre = `${config.repo}/${config.name}/${platform}/${config.version}`;
        vmake.info("[50%] 上传到 >>> %s", pre);

        await vmake.upload("./.publish/dest.zip", `${pre}.zip`);
        await vmake.upload("./.publish/md5.txt", `${pre}.md5`);
        await vmake.upload("./readme.md", `${config.repo}/${config.name}/readme.md`);

        vmake.success("%s", "[100%] 完成!");
    } catch (error) {
        console.log(error);
    }
};