vmake.task.example = function(){
console.log(`
vmake.js示例:
==============================================
const os = require("os");

vmake.task.test = async function () {
    let target = vmake.cpp("app", "bin"); // bin是可执行结果, static是静态库, shared是动态库

    target.add_cxxflag("-g");               // 添加g++编译参数
    target.add_cxxflag("-std=c++17");
    target.add_cxxflag("-Wall");
    target.add_cxxflag("-Wno-write-strings -Wno-unused-parameter -Wno-sign-compare -Wno-format-security");
    target.add_cxxflag("-finput-charset=UTF-8");

    target.add_package("${vmake.get_config("repo", "http://localhost:19901/vmake-repo")}", {
        "log": "1.1.0",                     // 添加版本为 1.1.0 的 log 库
    });

    if (os.platform() == "win32") {
        target.add_define("WIN32");         // 添加宏定义
    }

    target.add_include("src");              // 添加include目录
    target.add_files("src/*.cpp");          // 添加cpp源文件目录
    target.add_files("test/*.cpp");

    target.add_static_link("pthread");      // 添加静态链接库

    // target.add_ldflag("-static");        // 添加链接参数 
    // target.add_dynamic_link("pthread");  // 添加动态链接库
    // target.add_objs("res/icon/icon.o");  // 添加.o文件
    // target.set_multi_process(2);         // 设置构建是使用的进程数

    target.set_outdir("bin");
    await target.build();
};

vmake.task.release = async function () {
    let target = vmake.cpp("log", "static");

    target.add_cxxflag("-g");
    target.add_cxxflag("-std=c++17");
    target.add_cxxflag("-Wall");
    target.add_cxxflag("-Wno-write-strings -Wno-unused-parameter -Wno-sign-compare -Wno-format-security");
    target.add_cxxflag("-finput-charset=UTF-8");

    target.add_package("${vmake.get_config("repo", "http://localhost:19901/vmake-repo")}", {
        "log": "1.1.0",
    });

    if (os.platform() == "win32") {
        target.add_define("WIN32");
    }

    target.add_include("src");
    target.add_files("src/*.cpp");
    
    await target.build();

    vmake.release(target, {
        includefiles: ["log.h", "log_rollfile.h"],
        version: "1.1.0",
        repo: "http://127.0.0.1:19901/vmake-repo",
    });
};
==============================================
`);
}