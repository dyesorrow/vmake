const fs = require('fs');
const path = require('path');
const os = require('os');
const adm_zip = require("adm-zip");

async function handle_dependencies_pkg(target, pkg) {
    let build_dir = target.build_dir;

    let remote_pre = pkg.repo + "/" + pkg.name + "/" + os.platform() + "-" + pkg.version;
    let local_zip = build_dir + "/lib/" + pkg.name + "-" + pkg.version + ".zip";
    let pkg_dir = build_dir + "/lib/" + pkg.name;

    let include_dir = pkg_dir + "/include";
    let lib_dir = pkg_dir + "/lib";
    let bin_dir = pkg_dir + "/bin";

    async function check_pkg() {
        if (!fs.existsSync(pkg_dir)) {
            return false;
        }

        try {
            // 优先使用远程的md5文件
            let remote_md5 = await vmake.get_content(remote_pre + ".md5");
            let md5_data = JSON.parse(remote_md5);
            pkg.md5 = md5_data; // 取出md5文件

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
                    msg = `file not same: local md5 ${computed_md5}, expect md5 ${md5_data[it]}, ${file}`;
                    break;
                }
            }
            if (changed) {
                vmake.warn("%s: remote package have changed, will download newest. %s", pkg.name, msg);
                return false;
            }
        } catch (error) {
            // 如果远程的md5文件无法使用，则只判断文件夹是否存在
            vmake.warn("%s: %s. will ignore the check for this dependency", pkg.name, error);
        }
        return true;
    }

    async function download_remote_pkg() {
        let url = remote_pre + ".zip";
        try {
            vmake.rm(pkg_dir);
            await vmake.download(url, local_zip);
            const unzip = new adm_zip(local_zip);
            vmake.mkdirs(pkg_dir);
            unzip.extractAllTo(pkg_dir);

            if (!pkg.md5) {
                pkg.md5 = {};
                pkg.md5[".publish/dest.zip"] = vmake.md5sum(local_zip);
            }

            fs.rmSync(local_zip);
        } catch (error) {
            vmake.error("handle package error, url=%s, error: %s", url, error);
            process.exit(-1);
        }
    }

    if (!await check_pkg()) {
        await download_remote_pkg();
    }

    target.add_include(include_dir);
    target.add_libdir(lib_dir);
    if (fs.existsSync(lib_dir)) {
        if (fs.readdirSync(lib_dir).length > 0) {
            vmake.debug("add link " + pkg.name);
            target.add_link(pkg.name);
        }
    }
    // 复制资源文件到bin目录
    if (fs.existsSync(bin_dir)) {
        vmake.debug("copy bin dir");
        vmake.copy(bin_dir, build_dir + "/dest/");
    }
    // 如果有依赖的信息，则会进行依赖的信息校验
    if (fs.existsSync(pkg_dir + "/dependencies.json")) {
        pkg.dependency_info = JSON.parse(fs.readFileSync(pkg_dir + "/dependencies.json").toString());
    }
}

async function handle_dependencies(target) {
    let build_dir = target.build_dir;
    let target_config = target.get_config();

    if (!fs.existsSync(build_dir + "/lib")) {
        vmake.mkdirs(build_dir + "/lib");
    }
    let pkg_info = {};
    for (let i = 0; i < target_config.packages.length; i++) {
        let pkg = target_config.packages[i];
        try {
            vmake.info("[%3d%] %s", Math.floor(10 / target_config.packages.length * (i + 1)), `resolve dependencies: ${pkg.name}`);
            await handle_dependencies_pkg(target, pkg);
            pkg_info[pkg.name] = {
                repo: pkg.repo,
                version: pkg.version,
                md5: pkg.md5,
            };
        } catch (error) {
            vmake.error("%s", error);
            process.exit(-1);
        }
    }
    fs.writeFileSync(build_dir + "/lib/dependencies.json", JSON.stringify(pkg_info, null, 4));

    // 检查依赖信息是否正确
    let dependencies_log_info = [];
    for (let i = 0; i < target_config.packages.length; i++) {
        const pkg = target_config.packages[i];
        if (pkg.dependency_info) {
            for (const dpkg_name in pkg.dependency_info) {
                const dpkg = pkg.dependency_info[dpkg_name];
                if (!pkg_info[dpkg_name]) {
                    dependencies_log_info.push({
                        "level": "error",
                        "msg": `dependency lose. ${pkg.name} need ${dpkg_name}:${dpkg.version}`
                    });
                    continue;
                }
                if (pkg_info[dpkg_name].version != dpkg.version) {
                    dependencies_log_info.push({
                        "level": "warn",
                        "msg": `version not same. ${pkg.name} need ${dpkg_name}:${dpkg.version}`
                    });
                    continue;
                }
                if (pkg_info[dpkg_name].md5[".publish/dest.zip"] != dpkg.md5[".publish/dest.zip"]) {
                    dependencies_log_info.push({
                        "level": "warn",
                        "msg": `build result not same. ${pkg.name} need ${dpkg_name}:${dpkg.version}:${dpkg.md5[".publish/dest.zip"]}. while this vmake config is: ${dpkg_name}:${dpkg.version}:${pkg_info[dpkg_name].md5[".publish/dest.zip"]}`
                    });
                    continue;
                }
            }
        } else {
            vmake.debug("not dependency_info for pkg %s, will ignore", pkg.name);
        }
    }

    let has_error = false;
    for (const it of dependencies_log_info) {
        if (it.level == "warn") {
            vmake.warn("%s", it.msg);
        }
        if (it.level == "error") {
            has_error = true;
            vmake.error("%s", it.msg);
        }
    }

    if (has_error) {
        process.exit(-1);
    }
}

function get_obj_name(cpp_name) {
    return cpp_name.replaceAll("/", "_").replaceAll(".", "_").replaceAll("\\", "_") + ".o";
}

async function handle_obj_list_get(target, obj_list, change_list) {
    let build_dir = target.build_dir;
    let target_config = target.get_config();
    const obj_dir = build_dir + "/obj";


    for (const files of target_config.files) {
        let command = "g++ -MM";
        for (const inc of target_config.includes) {
            command += " -I " + inc;
        }
        for (const def of target_config.defines) {
            command += " -D" + def;
        }
        command += " " + files;
        command += " > " + obj_dir + "/tmp.d";

        vmake.debug("%s", command);
        vmake.run(command);

        let result = fs.readFileSync(obj_dir + "/tmp.d").toString();
        result = result.replaceAll(/\\\r?\n/g, " ");
        let reg = /(.+?): (.+)/g;
        let rst = reg.exec(result);
        while (rst) {
            let depends = rst[2].trim().split(" ");
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

    try {
        let old_obj_list = {};
        if (fs.existsSync(obj_dir + "/info.txt")) {
            old_obj_list = JSON.parse(fs.readFileSync(obj_dir + "/info.txt"));
            for (const source in old_obj_list) {
                let objname = get_obj_name(source);
                let objpath = obj_dir + "/" + objname;

                // 检查文件是否删除
                if (!obj_list[source]) {
                    // 文件删除
                    if (fs.existsSync(objpath)) {
                        fs.rmSync(objpath);
                    }
                    continue;
                }
                // 检查依赖文件是否发生变化
                for (const file in old_obj_list[source]) {
                    if (!obj_list[source][file] || obj_list[source][file] != old_obj_list[source][file]) {
                        vmake.debug("%s %s %s %s", "chaneg", source, file, change_list[source]);
                        change_list[source] = obj_list[source];
                        break;
                    }
                }
            }
        }
        for (const source in obj_list) {
            let objname = get_obj_name(source);
            let objpath = obj_dir + "/" + objname;

            // 目标obj不存在
            if (!fs.existsSync(objpath)) {
                change_list[source] = obj_list[source];
                continue;
            }

            // 文件新增，删除对应的obj文件
            if (!old_obj_list[source]) {
                change_list[source] = obj_list[source];
                vmake.debug("%s %s", "add", change_list[source]);
                continue;
            }
        }

    } catch (error) {
    }
    vmake.debug("%s", obj_list);
}


async function handle_obj_complie(target, change_list) {
    let target_config = target.get_config();
    const obj_dir = target.build_dir + "/obj";

    let obj_i = 0;
    for (const source in change_list) {
        let objname = get_obj_name(source);
        let command = "g++ -c " + target_config.cxxflags.join(" ");
        for (const def of target_config.defines) {
            command += " -D" + def;
        }
        for (const inc of target_config.includes) {
            command += " -I " + inc;
        }
        command += " " + source + ` -o ${obj_dir}/` + objname;
        vmake.info("[%3d%] compile %s", 12 + Math.floor(85 / Object.keys(change_list).length * (++obj_i)), source);
        console.log(command);

        try {
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit(-1);
        }
    }
}

function handle_remove_old_obj(target, obj_list) {
    const obj_dir = target.build_dir + "/obj";
    let obj_result_map = {};
    for (const source in obj_list) {
        let objname = get_obj_name(source);
        obj_result_map[objname] = true;
    }
    let file_exits = fs.readdirSync(obj_dir);
    for (const it of file_exits) {
        if (it.endsWith(".o") && !obj_result_map[it]) {
            console.log(`delete not need obj: ${obj_dir}/${it}`);
            vmake.rm(`${obj_dir}/${it}`);
        }
    }
}

async function target_complie(target) {
    const obj_dir = target.build_dir + "/obj";
    vmake.mkdirs(obj_dir);

    let obj_list = {};
    let change_list = {};
    await handle_dependencies(target);
    await handle_obj_list_get(target, obj_list, change_list);
    await handle_obj_complie(target, change_list);
    handle_remove_old_obj(target, obj_list);
    fs.writeFileSync(obj_dir + "/info.txt", JSON.stringify(obj_list, null, 4));
}

async function vscode_cpp_properties(config) {
    let includes = []
    for (let it of config.includes) {
        includes.push("${workspaceFolder}/" + it);
    }

    let configurations = {
        configurations: [{
            name: "GCC",
            includePath: includes,
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
            vmake.info("[%3d%] %s", 99, "link bin result: " + target_dir + "/" + target_name);
            console.log(command);
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
            vmake.info("[%3d%] %s", 99, "link static result: " + `${target_dir + "/lib" + target_name}.a`);
            console.log(command);
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
            vmake.info("[%3d%] %s", 99, "link shared result: " + target_dir + "/lib" + target_name + ".so ");
            console.log(command);
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

vmake.cpp = function (target_name, target_type) {
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
