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
        try {
            // 优先使用远程的md5文件
            let remote_md5 = await vmake.get_content(remote_pre + ".md5");
            let md5_data = JSON.parse(remote_md5);
            pkg.md5 = md5_data; // 取出md5数据

            if (!fs.existsSync(pkg_dir)) {
                return false;
            }

            let changed = false;
            let msg = "";
            for (const it in md5_data) {
                if (it == ".publish/dest.zip") {
                    continue;
                }
                let file = pkg_dir + "/" + it;
                if (!fs.existsSync(file)) {
                    if (md5_data[it] == "not exist") {
                        continue;
                    }
                    changed = true;
                    msg = `文件丢失: ${file}`;
                    break;
                }

                let computed_md5 = vmake.md5sum(file);
                if (computed_md5 != md5_data[it]) {
                    changed = true;
                    msg = `${file} 发生变化, 本地:${computed_md5}, 远程:${md5_data[it]}`;
                    break;
                }
            }
            if (changed) {
                vmake.warn("%s: 远程文件发生改变. %s", pkg.name, msg);
                return false;
            }
        } catch (error) {
            // 如果远程的md5文件无法使用，则只判断文件夹是否存在
            vmake.warn("%s: %s. 远程md5无法获取，将忽略此依赖的检查", pkg.name, error);
            if (!pkg.md5) {
                pkg.md5 = {};
            }
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

            fs.rmSync(local_zip);
        } catch (error) {
            vmake.error("处理依赖包时出现错误, url=%s, error: %s", url, error);
            process.exit(-1);
        }
    }

    if (!await check_pkg()) {
        await download_remote_pkg();
    }

    target.add_include(include_dir);

    if (target.target_type != "static") {
        target.add_libdir(lib_dir);
        if (fs.existsSync(lib_dir)) {
            if (fs.readdirSync(lib_dir).length > 0) {
                vmake.debug("add link " + pkg.name);
                target.add_static_link(pkg.name);
            }
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
            vmake.info("[%3d%] %s", Math.floor(10 / target_config.packages.length * (i + 1)), `处理依赖: ${pkg.name}`);
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
                        "msg": `依赖缺失 ${pkg.name} 需要 ${dpkg_name}:${dpkg.version}`
                    });
                    continue;
                }
                if (pkg_info[dpkg_name].version != dpkg.version) {
                    dependencies_log_info.push({
                        "level": "warn", // 不一定造成编译失败
                        "msg": `依赖版本不同. ${pkg.name} 需要 ${dpkg_name}:${dpkg.version}`
                    });
                    continue;
                }
                for (const file_name in dpkg.md5) {
                    if (pkg_info[dpkg_name].md5[file_name] != dpkg.md5[file_name]) {
                        dependencies_log_info.push({
                            "level": "warn", // 不一定造成编译失败
                            "msg": `依赖冲突. ${pkg.name} 需要 ${dpkg_name}:${dpkg.version}:${file_name}, 期待: ${dpkg.md5[file_name]}, 本项目导入:${pkg_info[dpkg_name].md5[file_name]}`
                        });
                        continue;
                    }
                }
            }
        } else {
            vmake.debug("not dependency_info for pkg %s, will ignore", pkg.name);
        }
    }

    let has_error = false;
    for (const it of dependencies_log_info) {
        if (it.level == "error") {
            has_error = true;
            vmake.error("%s", it.msg);
        }
    }

    if (has_error) {
        process.exit(-1);
    }

    for (const it of dependencies_log_info) {
        if (it.level == "warn") {
            vmake.warn("%s", it.msg);
        }
    }
}

function get_obj_name(cpp_name) {
    return cpp_name.replaceAll("/", "_").replaceAll(".", "_").replaceAll("\\", "_") + ".o";
}

async function handle_obj_list_get(target, obj_list, change_list) {
    let build_dir = target.build_dir;
    let target_config = target.get_config();
    const obj_dir = build_dir + "/obj";


    try {
        await vmake.run_multi_process(target_config.files.length, target_config.process_num, async (build_at) => {
            let files = target_config.files[build_at];
            vmake.info("[%3d%] 检查: %s", 10 + Math.floor(20 / target_config.files.length * (build_at + 1)), files);

            let tmpd_name = files;
            tmpd_name = tmpd_name.replaceAll("\/", "_");
            tmpd_name = tmpd_name.replaceAll("\*", "_");
            tmpd_name = tmpd_name.replaceAll("\\", "_");
            tmpd_name = tmpd_name.replaceAll("\.", "_");
            tmpd_name = obj_dir + "/" + tmpd_name + "_" + build_at + ".d";

            let command = "g++ -MM";
            for (const inc of target_config.includes) {
                command += " -I " + inc;
            }
            for (const def of target_config.defines) {
                command += " -D" + def;
            }
            command += " " + files;
            command += " > " + tmpd_name;

            vmake.debug("%s", command);
            await vmake.exec(command);  // TODO 可能存在输出混乱的问题，遇到了再说

            let result = fs.readFileSync(tmpd_name).toString();
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
        });
    } catch (error) {
        vmake.error("%s", error);
        process.exit(-1);
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

async function handle_obj_complie(target, obj_list, change_list) {
    const obj_dir = target.build_dir + "/obj";

    let old_obj_list = {};
    if (fs.existsSync(obj_dir + "/info.txt")) {
        old_obj_list = JSON.parse(fs.readFileSync(obj_dir + "/info.txt"));
    }

    let target_config = target.get_config();
    let change_list_sources = [];
    for (const source in change_list) {
        change_list_sources.push(source);
    }

    try {
        await vmake.run_multi_process(change_list_sources.length, target_config.process_num, async (build_at) => {
            let source = change_list_sources[build_at];
            let objname = get_obj_name(source);
            let command = "g++ -fdiagnostics-color -c " + target_config.cxxflags.join(" ");
            for (const def of target_config.defines) {
                command += " -D" + def;
            }
            for (const inc of target_config.includes) {
                command += " -I " + inc;
            }
            command += " " + source + ` -o ${obj_dir}/` + objname;
            vmake.info("[%3d%] 编译: %s", 30 + Math.floor(67 / change_list_sources.length * (build_at + 1)), source);

            await vmake.exec(command); // TODO 可能存在输出混乱的问题，遇到了再说

            // 成功编译后就更新文件
            old_obj_list[source] = obj_list[source];
            fs.writeFileSync(obj_dir + "/info.txt", JSON.stringify(old_obj_list, null, 4));
        });
    } catch (error) {
        vmake.error("%s", error);
        process.exit(-1);
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
    await handle_obj_complie(target, obj_list, change_list);
    handle_remove_old_obj(target, obj_list);
    fs.writeFileSync(obj_dir + "/info.txt", JSON.stringify(obj_list, null, 4));
}

async function vscode_cpp_properties(config) {
    let includes = [];
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

    if (target_config.files.length == 0) {
        vmake.warn("没有源文件, 忽略链接操作, 将不会产生连接结果");
        return;
    }

    if (fs.existsSync("./res")) {
        vmake.copy("./res", target_dir); // 拷贝资源到目标目录
    }

    let static_links = [];
    for (const it of target_config.static_links) {
        static_links.push("-l" + it);
    }
    let dynamic_links = [];
    for (const it of target_config.dynamic_licks) {
        dynamic_links.push("-l" + it);
    }

    if (target_type == "bin") {
        // 链接
        let command = `g++ ${target_config.ldflags.join(" ")} ${build_dir}/obj/*.o ` + target_config.objs.join(" ");
        for (const lib of target_config.libdirs) {
            command += " -L " + lib;
        }
        command += " -o " + target_dir + "/" + target_name;
        if (static_links.length > 0) {
            command += " -Wl,-Bstatic -Wl,--start-group " + static_links.join(" ") + " -Wl,--end-group";
        }
        if (dynamic_links.length > 0) {
            command += " -Wl,-Bdynamic -Wl,--start-group " + dynamic_links.join(" ") + " -Wl,--end-group";
        }
        try {
            vmake.info("[%3d%] %s", 99, "构建可执行文件: " + target_dir + "/" + target_name);
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
            vmake.info("[%3d%] %s", 99, "构建静态库: " + `${target_dir + "/lib" + target_name}.a`);
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
            vmake.info("[%3d%] %s", 99, "构建动态库: " + target_dir + "/lib" + target_name + ".so ");
            console.log(command);
            vmake.run(command);
        } catch (error) {
            vmake.error("%s", error);
            process.exit(-1);
        }
        return;
    }
    vmake.error("不支持的目标类型 [%s], 请从以下进行选择: bin, static, shared", target_type);
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

    vmake.success("构建: %s -> %s, %s", process.cwd(), target_name, target_type);

    let target_config = {
        packages: [],
        cxxflags: [],
        includes: [],
        defines: [],
        files: [],
        libdirs: [],
        static_links: [],
        dynamic_licks: [],
        ldflags: [],
        objs: [],
        process_num: 1,
    };

    let user_param_process_num_set = false;
    function update_process_num() {
        let process_num = os.cpus().length;
        process_num = Math.floor(process_num / 2);
        if (process_num == 0) {
            process_num = 1;
        }
        target_config.process_num = process_num;

        for (let i = 0; i < vmake.args.length; i++) {
            if (vmake.args[i] == "-j") {
                let reg = /\d+/g;
                if (vmake.args.length > i + 1 && vmake.args[i + 1].match(reg)) {
                    target_config.process_num = Number.parseInt(vmake.args[i + 1]);
                    user_param_process_num_set = true;
                    break;
                } else {
                    vmake.warn("发现 -j 参数, 但是没有找到设置的数值, 将被忽略");
                }
            } else {
                let reg = /-j(\d+)/g;
                let rst = reg.exec(vmake.args[i]);
                if (rst) {
                    target_config.process_num = Number.parseInt(rst[1]);
                    user_param_process_num_set = true;
                    break;
                }
            }
        }
    }
    update_process_num();



    let target = {
        target_name: target_name,
        target_type: target_type,
        target_dir: build_dir + "/dest",
        build_dir: build_dir,
        set_outdir: (outdir) => {
            target_config.outdir = outdir;
        },
        set_multi_process(process_num) {
            if (!user_param_process_num_set) {
                target_config.process_num = process_num;
            }
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
        add_define: (...data) => {
            target_config.defines.push(...data);
        },
        add_files: (data) => {
            target_config.files.push(data);
        },
        add_objs: (data) => {
            target_config.objs.push(data);
        },
        add_libdir: (...data) => {
            if (target_type == "static") {
                vmake.warn("static 目标, 将忽略库目录设置: %s", data);
                return;
            }
            for (const it of data) {
                target_config.libdirs.push(it);
            }
        },
        add_ldflag: (...data) => {
            if (target_type == "static") {
                vmake.warn("static 目标, 将忽略链接参数: %s", data);
                return;
            }
            for (const it of data) {
                target_config.ldflags.push(it);
            }
        },
        add_static_link: (...data) => {
            if (target_type == "static") {
                vmake.warn("static 目标, 将忽略静态链接配置: %s", data);
                return;
            }
            for (const it of data) {
                target_config.static_links.push(it);
            }
        },
        add_dynamic_link: (...data) => {
            if (target_type == "static") {
                vmake.warn("static 目标, 将忽略动态链接配置: %s", data);
                return;
            }
            for (const it of data) {
                target_config.dynamic_licks.push(it);
            }
        },
        get_config: () => {
            return target_config;
        },
        build: async () => {
            let start_time = Date.now();
            vmake.log("编译使用进程数: %d", target_config.process_num);
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
            vmake.success("[100%] 构建完成! 耗时: %s", time_format(Date.now() - start_time));
        }
    };
    return target;
};
