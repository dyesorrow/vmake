vmake.task.example = function(){
console.log(`
vmake.js示例:
==============================================
const os = require("os");

vmake.task.test = async function () {
    let target = vmake.cpp("app", "bin");

    target.add_cxxflag("-g");
    target.add_cxxflag("-std=c++17");
    target.add_cxxflag("-Wall");
    target.add_cxxflag("-Wno-write-strings -Wno-unused-parameter -Wno-sign-compare -Wno-format-security");
    target.add_cxxflag("-finput-charset=UTF-8");
    target.add_cxxflag("-Wextra");

    if (os.platform() == "win32") {
        target.add_define("WIN32");
    }

    target.add_include("src");
    target.add_files("src/*.cpp");
    target.add_files("test/*.cpp");

    target.add_ldflag("-static");
    target.add_link("pthread");

    target.set_outdir("dest");
    await target.build();
};

vmake.task.release = async function () {
    let target = vmake.cpp("log", "static");

    target.add_cxxflag("-g");
    target.add_cxxflag("-std=c++17");
    target.add_cxxflag("-Wall");
    target.add_cxxflag("-Wno-write-strings -Wno-unused-parameter -Wno-sign-compare -Wno-format-security");
    target.add_cxxflag("-finput-charset=UTF-8");
    target.add_cxxflag("-Wextra");

    if (os.platform() == "win32") {
        target.add_define("WIN32");
    }

    target.add_include("src");
    target.add_files("src/*.cpp");

    target.add_ldflag("-static");
    target.add_link("pthread");
    
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