const fs = require('fs');
const path = require('path');
const os = require('os');
const adm_zip = require("adm-zip");

async function handle_pkg(target, pkg) {
    let build_dir = target.build_dir;

    let remote_pre = pkg.repo + "/" + pkg.name + "/" + os.platform() + "-" + pkg.version;
    let local_zip = build_dir + "/lib/" + pkg.name + "-" + pkg.version + ".zip";
    let pkg_dir = build_dir + "/lib/" + pkg.name;

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
            let msg = "";
            for (const it in md5_data) {
                if (it == ".publish/dest.zip") {
                    continue;
                }
                let file = pkg_dir + "/" + it;
                if (!fs.existsSync(file)) {
                    changed = true;
                    msg = `file lose: ${file}`;
                    break;
                }

                let computed_md5 = vmake.md5sum(file);
                if (computed_md5 != md5_data[it]) {
                    changed = true;
                    msg = `file not same: local=${computed_md5}, expect=${md5_data[it]}`;
                    break;
                }
            }
            if (changed) {
                vmake.warn("%s: remote package have changed, will download newest. %s", pkg.name, msg);
                return false;
            }

            return true;
        } catch (error) {
            // 如果远程的md5文件无法使用，则只判断文件夹是否存在
            vmake.warn("%s: %s. will ignore the check for this dependency", pkg.name, error);
            return true;
        }
    }

    if (!await check_file()) {
        let url = remote_pre + ".zip";
        try {
            vmake.rm(pkg_dir);
            await vmake.download(url, local_zip);
            const unzip = new adm_zip(local_zip);
            vmake.mkdirs(pkg_dir);
            unzip.extractAllTo(pkg_dir);
            fs.rmSync(local_zip);
        } catch (error) {
            vmake.error("handle package error, url=%s, error: %s", url, error);
            process.exit(-1);
        }
    }

    target.add_include(include_dir);
    target.add_libdir(lib_dir);
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
            vmake.debug("add link " + pkg.name);
            target.add_link(pkg.name);
        }
    }
}

async function target_complie(target) {
    let build_dir = target.build_dir;
    let target_config = target.get_config();

    for (let i = 0; i < target_config.packages.length; i++) {
        const pkg = target_config.packages[i];
        try {
            vmake.info("[%3d%] %s", Math.floor(10 / target_config.packages.length * (i + 1)), `resolve dependencies: ${pkg.name}`);
            await handle_pkg(target, pkg);
        } catch (error) {
            vmake.error("%s", error);
            process.exit(-1);
        }
    }

    vmake.mkdirs(build_dir + "/obj");

    let obj_list = {};
    for (const files of target_config.files) {
        let command = "g++ -MM";
        for (const inc of target_config.includes) {
            command += " -I " + inc;
        }
        for (const def of target_config.defines) {
            command += " -D" + def;
        }
        command += " " + files;
        command += " > " + build_dir + "/obj/tmp.d";

        vmake.debug("%s", command);
        vmake.run(command);

        let result = fs.readFileSync(build_dir + "/obj/tmp.d").toString();
        result = result.replaceAll(/\\\r?\n/g, " ");
        vmake.debug("==>> ", result);

        let reg = /(.+?): (.+)/g;
        let rst = reg.exec(result);
        while (rst) {
            let depends = rst[2].trim().split(" ");
            vmake.debug("rst=%s, depends = %s", rst, depends);
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
        let content = fs.readFileSync(build_dir + "/obj/info.txt");
        let last = JSON.parse(content);
        let change = {};
        for (const tar in last) {
            if (!obj_list[tar]) {
                // 文件删除
                let objpath = build_dir + "/obj/" + get_obj_name(tar);
                if (fs.existsSync(objpath)) {
                    fs.rmSync(build_dir + "/obj/" + objname);
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

    let obj_i = 0;
    for (const source in obj_list) {
        let objname = get_obj_name(source);
        let command = "g++ -c " + target_config.cxxflags.join(" ");
        for (const def of target_config.defines) {
            command += " -D" + def;
        }
        for (const inc of target_config.includes) {
            command += " -I " + inc;
        }
        command += " " + source + ` -o ${build_dir}/obj/` + objname;
        vmake.info("[%3d%] %s -> %s", 12 + Math.floor(85 / Object.keys(obj_list).length * (++obj_i)), source, command);

        try {
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit(-1);
        }
    }

    fs.writeFileSync(build_dir + "/obj/info.txt", JSON.stringify(raw_obj_list, null, 4));
}

async function vscode_cpp_properties(config) {

    let configurations = {
        configurations: [{
            name: "GCC",
            includePath: config.includes,
            defines: config.defines,
            cStandard: "c17",
            cppStandard: "c++17",
            intelliSenseMode: "linux-gcc-x64"
        }],
        version: 4,
    };
    vmake.mkdirs(".vscode");
    fs.writeFileSync(".vscode/c_cpp_properties.json", JSON.stringify(configurations, null, 4));
}

async function target_link(target) {

    let build_dir = target.build_dir;
    let target_dir = target.target_dir;
    let target_config = target.get_config();
    let target_name = target.target_name;
    let target_type = target.target_type;

    vmake.mkdirs(target_dir);

    let links = [];
    for (const it of target_config.link) {
        links.push("-l" + it);
    }

    if (target_type == "bin") {
        // 链接
        let command = `g++ ${target_config.ldflags.join(" ")} ${build_dir}/obj/*.o ` + target_config.objs.join(" ");
        for (const lib of target_config.libdirs) {
            command += " -L " + lib;
        }
        command += " -o " + target_dir + "/" + target_name + " -Wl,--start-group " + links.join(" ") + " -Wl,--end-group";
        try {
            vmake.info("[%3d%] %s", 99, command);
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit(-1);
        }
        return;
    }

    if (target_type == "static") {
        // 静态链接库
        let command = `ar rcs ${target_dir + "/lib" + target_name}.a ${build_dir}/obj/*.o ` + target_config.objs.join(" ");
        try {
            vmake.info("[%3d%] %s", 99, command);
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit(-1);
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
            command += " -o " + target_dir + "/lib" + target_name + ".dll " + target_config.ldflags.join(" ");
        }
        if (os.platform() == "linux") {
            command += " -o " + target_dir + "/lib" + target_name + ".so " + target_config.ldflags.join(" ");
        }
        try {
            vmake.info("[%3d%] %s", 99, command);
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit(-1);
        }
        return;
    }
    vmake.error("Not support target [%s], please choose from the following: bin, static, shared", target_type);
    process.exit(-1);
}

function time_format(time) {
    let result = "";
    let unum = [1, 1000, 60, 60, 24, 0x7fffffff];
    let utxt = ["ms", "s", "m", "h", "d"];
    for (let i = 0; i < unum.length - 1; i++) {
        if (time / unum[i + 1] >= 1) {
            result = (time % unum[i + 1]) + utxt[i] + result;
            time = Math.floor(time / unum[i + 1]);
        } else {
            result = time + utxt[i] + result;
            break;
        }
    }
    return result;
}

vmake.build = function (target_name, target_type) {
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

    let target = {
        target_name: target_name,
        target_type: target_type,
        target_dir: build_dir + "/dest",
        build_dir: build_dir,
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
        build: async () => {
            let start_time = Date.now();
            vmake.info("Project: %s -> %s, %s", process.cwd(), target_name, target_type);
            try {
                await target_complie(target);
                await target_link(target);
                await vscode_cpp_properties(target_config);
            } catch (error) {
                vmake.error("%s", error);
                process.exit(-1);
            }
            if (target_config.outdir) {
                vmake.copy(target.target_dir, target_config.outdir);
            }
            vmake.success("[100%] build end! time cost: %s", time_format(Date.now() - start_time));
        },
        require: async (url, force) => {
            let name = url.substring(url.lastIndexOf("/") + 1);
            let dist_path = build_dir + "/script/" + name;
            if (!fs.existsSync(dist_path) || force) {
                await vmake.download(url, dist_path);
            }
            return require(path.join(process.cwd(), dist_path));
        }
    };
    return target;
};
