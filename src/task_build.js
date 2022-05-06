const fs = require('fs');
const path = require('path');
const os = require('os');
const adm_zip = require("adm-zip");

async function handle_pkg(dest, build_dir, target_config) {
    vmake.debug("handle ", dest, build_dir, target_config);

    let remote_pre = target_config.repo + "/" + target_config.name + "/" + os.platform() + "-" + target_config.version;
    let local_zip = build_dir + "/lib/" + target_config.name + "-" + target_config.version + ".zip";
    let pkg_dir = build_dir + "/lib/" + target_config.name;

    let include_dir = pkg_dir + "/include";
    let lib_dir = pkg_dir + "/lib";
    let bin_dir = pkg_dir + "/bin";

    async function check_file() {
        if (!fs.existsSync(pkg_dir)) {
            return false;
        }

        try {
            // 优先使用远程的md5文件
            let remote_md5 = await vmake.get_content(remote_pre + ".md5");
            let md5_data = JSON.parse(remote_md5);
            let changed = false;
            for (const it in md5_data) {
                if (it == ".publish/dest.zip") {
                    continue;
                }
                let file = pkg_dir + "/" + it;
                if (!fs.existsSync(file)) {
                    changed = true;
                    break;
                }
                if (vmake.md5sum(file) != md5_data[it]) {
                    changed = true;
                    break;
                }
            }
            if (changed) {
                vmake.warn("%s: remote package have changed, will download newest", target_config.name);
                return false;
            }

            return true;
        } catch (error) {
            // 如果远程的md5文件无法使用，则只判断文件夹是否存在
            vmake.warn("%s: %s. will ignore the check for this dependency", target_config.name, error);
            return true;
        }
    }

    if (!await check_file()) {
        vmake.rm(pkg_dir);
        await vmake.download(remote_pre + ".zip", local_zip);
        const unzip = new adm_zip(local_zip);
        vmake.mkdirs(pkg_dir);
        unzip.extractAllTo(pkg_dir);
        fs.rmSync(local_zip);
    }

    dest.add_include(include_dir);
    dest.add_libdir(lib_dir);
    vmake.debug("add include dir: ", include_dir);
    vmake.debug("add lib dir: ", lib_dir);

    // 复制资源文件到bin目录
    if (fs.existsSync(bin_dir)) {
        vmake.debug("check bin dir");
        for (const it of fs.readdirSync(bin_dir)) {
            vmake.debug("copy %s to %s", it, build_dir + "/dest/" + it);
            fs.cpSync(bin_dir + "/" + it, build_dir + "/dest/" + it, {
                force: true
            });
        }
    }
    if (fs.existsSync(lib_dir)) {
        if (fs.readdirSync(lib_dir).length > 0) {
            vmake.debug("add link " + target_config.name);
            dest.add_link(target_config.name);
        }
    }
}

async function target_complie(dest, dir, config) {
    for (let i = 0; i < config.packages.length; i++) {
        const pkg = config.packages[i];
        try {
            vmake.info("[%3d%] %s", Math.floor(10 / config.packages.length * (i + 1)), `resolve dependencies: ${pkg.name}`);
            await handle_pkg(dest, dir, pkg);
        } catch (error) {
            vmake.error("%s", error);
            process.exit();
        }
    }

    // vmake.info("[%3d%] %s", 11, "obj dependency files change check");

    vmake.mkdirs(dir + "/obj");

    let obj_list = {};
    for (const files of config.files) {
        let command = "g++ -MM";
        for (const inc of config.includes) {
            command += " -I " + inc;
        }
        for (const def of config.defines) {
            command += " -D" + def;
        }
        command += " " + files;
        command += " > " + dir + "/obj/tmp.d";

        vmake.debug("%s", command);
        vmake.run(command);

        let result = fs.readFileSync(dir + "/obj/tmp.d").toString();
        result = result.replaceAll(/\\\r?\n/g, " ");
        vmake.debug("==>> ", result);

        let reg = /(.+?): (.+)/g;
        let rst = reg.exec(result);
        while (rst) {
            let depends = rst[2].split(" ");
            vmake.debug("%s", depends);
            obj_list[depends[0]] = {};
            for (let dep of depends) {
                dep = dep.trim();
                if (dep.length == 0) {
                    continue;
                }
                obj_list[depends[0]][dep] = vmake.md5sum(dep);
            }
            rst = reg.exec(result);
        }
    }
    vmake.debug("%s", obj_list);
    let raw_obj_list = obj_list;


    function get_obj_name(cpp_name) {
        return cpp_name.replaceAll("/", "_").replaceAll(".", "_").replaceAll("\\", "_") + ".o";
    }

    try {
        let content = fs.readFileSync(dir + "/obj/info.txt");
        let last = JSON.parse(content);
        let change = {};
        for (const tar in last) {
            if (!obj_list[tar]) {
                // 文件删除
                let objpath = dir + "/obj/" + get_obj_name(tar);
                if (fs.existsSync(objpath)) {
                    fs.rmSync(dir + "/obj/" + objname);
                }
                continue;
            }
            for (const file in last[tar]) {
                if (!obj_list[tar][file] || obj_list[tar][file] != last[tar][file]) {
                    // 发生变化
                    vmake.debug("%s %s %s %s", "chaneg", tar, file, change[tar]);
                    change[tar] = obj_list[tar];
                    break;
                }
            }
        }
        for (const tar in obj_list) {
            if (!last[tar]) {
                // 文件新增，删除对应的obj文件
                change[tar] = obj_list[tar];
                vmake.debug("%s %s", "add", change[tar]);
                continue;
            }
        }
        obj_list = change;
        vmake.debug("%s", obj_list);
    } catch (error) {
    }


    // vmake.info("[%3d%] %s", 12, "obj files make");

    let obj_i = 0;
    for (const source in obj_list) {
        let objname = get_obj_name(source);
        let command = "g++ -c " + config.cxxflags.join(" ");
        for (const def of config.defines) {
            command += " -D" + def;
        }
        for (const inc of config.includes) {
            command += " -I " + inc;
        }
        command += " " + source + ` -o ${dir}/obj/` + objname;
        vmake.info("[%3d%] %s -> %s", 12 + Math.floor(85 / Object.keys(obj_list).length * (++obj_i)), source, command);

        try {
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit();
        }
    }

    fs.writeFileSync(dir + "/obj/info.txt", JSON.stringify(raw_obj_list, null, 4));
}

async function vscode_cpp_properties(config) {

    let configurations = {
        configurations: [{
            name: "Win32",
            includePath: config.includes,
            defines: config.defines,
            cStandard: "gnu17",
            cppStandard: "gnu++17",
            intelliSenseMode: "linux-gcc-x64"
        }],
        version: 4,
    };
    vmake.mkdirs(".vscode");
    fs.writeFileSync(".vscode/c_cpp_properties.json", JSON.stringify(configurations, null, 4));
}

async function target_link(target_config, build_dir, target_name, target_type) {

    vmake.mkdirs(build_dir + "/dest");

    // vmake.info("[%3d%] %s", 98, "dest link");

    let links = [];
    for (const it of target_config.link) {
        links.push("-l" + it);
    }
    target_config.ldflags = links.concat(target_config.ldflags);

    if (target_type == "bin") {
        // 链接
        let command = `g++ ${build_dir}/obj/*.o ` + target_config.objs.join(" ");
        for (const lib of target_config.libdirs) {
            command += " -L " + lib;
        }
        command += " -o " + build_dir + "/dest/" + target_name + " " + target_config.ldflags.join(" ");
        try {
            vmake.info("[%3d%] %s", 99, command);
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit();
        }
        return;
    }

    if (target_type == "static") {
        // 静态链接库
        let command = `ar rcs ${build_dir + "/dest/lib" + target_name}.a ${build_dir}/obj/*.o ` + target_config.objs.join(" ");
        try {
            vmake.info("[%3d%] %s", 99, command);
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit();
        }
        return;
    }

    if (target_type == "shared") {
        // 动态链接库
        let command = `g++ --shared ${build_dir}/obj/*.o` + target_config.objs.join(" ");
        for (const lib of target_config.libdirs) {
            command += " -L " + lib;
        }
        if (os.platform() == "win32") {
            command += " -o " + build_dir + "/dest/lib" + target_name + ".dll " + target_config.ldflags.join(" ");
        }
        if (os.platform() == "linux") {
            command += " -o " + build_dir + "/dest/lib" + target_name + ".so " + target_config.ldflags.join(" ");
        }
        try {
            vmake.info("[%3d%] %s", 99, command);
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit();
        }
        return;
    }
    vmake.error("Not support target [%s], please choose from the following: bin, static, shared", target_type);
    process.exit();
}

vmake.target = function (target_name, taget_type) {
    const build_dir = "build/" + target_name + "/" + os.platform();
    vmake.mkdirs(build_dir);

    let target_config = {
        packages: [],
        cxxflags: [],
        includes: [],
        defines: [],
        files: [],
        libdirs: [],
        link: [],
        ldflags: [],
        before: [],
        after: [],
        objs: [],
    };
    let dest = {
        build_dir: build_dir,
        dest_dir: build_dir + "/dest",
        set_outdir: (outdir) => {

            target_config.outdir = outdir;
        },
        add_package: (repo, target_map) => {
            for (const key in target_map) {
                target_config.packages.push({
                    repo,
                    name: key,
                    version: target_map[key]
                });
            }
        },
        add_cxxflag: (data) => {
            target_config.cxxflags.push(data);
        },
        add_include: (data) => {
            target_config.includes.push(data);
        },
        add_define: (data) => {
            target_config.defines.push(data);
        },
        add_files: (data) => {
            target_config.files.push(data);
        },
        add_objs: (data) => {
            target_config.objs.push(data);
        },
        add_libdir: (data) => {
            target_config.libdirs.push(data);
        },
        add_ldflag: (data) => {
            target_config.ldflags.push(data);
        },
        add_before: (func) => {
            target_config.before.push(func);
        },
        add_after: (func) => {
            target_config.after.push(func);
        },
        add_link: (data) => {
            target_config.link.push(data);
        },
        get_config: () => {
            return target_config;
        },
        build: () => {
            let start_time = Date.now();
            vmake.info("Project: %s -> %s, %s", process.cwd(), target_name, taget_type);
            try {
                await target_complie(dest, build_dir, target_config);
                await target_link(target_config, build_dir, target_name, taget_type);
                await vscode_cpp_properties(target_config);
            } catch (error) {
                vmake.error("%s", error);
                process.exit();
            }
            if (target_config.outdir) {
                if (os.platform() == "win32") {
                    vmake.copy(dest.dest_dir + "/" + target_name + ".exe", path.join(target_config.outdir, target_name + ".exe"));
                }
                else if (os.platform() == "linux") {
                    vmake.copy(dest.dest_dir + "/" + target_name, path.join(target_config.outdir, target_name));
                }
            }
            vmake.success("[100%] build end! time cost: %s", vmake.time_format(Date.now() - start_time));
        }
    };
    return dest;
};
