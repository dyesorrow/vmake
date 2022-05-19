// \u001b[0m	还原
// \u001b[30m	黑色
// \u001b[31m	红色
// \u001b[32m	绿色
// \u001b[33m	黄色
// \u001b[34m	蓝色
// \u001b[35m	洋红色
// \u001b[36m	青色
// \u001b[37m	白色

// \u001b[{n}A	光标向上移动n格
// \u001b[{n}B	光标向下移动n格
// \u001b[{n}C	光标向右移动n格
// \u001b[{n}D	光标向左移动n格
// \u001b[{n}E	光标按行向下移动n行并且将光标移至行首
// \u001b[{n}F	光标按行向上移动n行并且将光标移至行首
// \u001b[{n}G	将光标移至第n列（行数与当前所在行保持一致）
// \u001b[{n};{m}H	将光标移至第n行m列，坐标原点从屏幕左上角开始
// \u001b[{s}	保存光标当前所在位置
// \u001b[{u}	读取光标上一次保存的位置

vmake.process_bar = function (info, piece) {
    info = info || "";
    piece = piece || ">";

    let bar = {
        process: 0
    };

    function print() {
        let output = "[";
        let i = 0;
        const max = 20;
        let end = Number.parseInt(bar.process * max);
        for (; i < end; i++) {
            output += piece;
        }
        for (; i < max; i++) {
            output += " ";
        }
        output += "]";
        output += " " + Number.parseInt(100 * bar.process) + "%";
        process.stdout.write("\u001b[u");
        process.stdout.write(output);
    }

    bar.set_process = function (at) {
        bar.process = at;
        print();
    };

    bar.start = function () {
        process.stdout.write(info);
        process.stdout.write("\u001b[s");
        print();
    };

    bar.end = function () {
        process.stdout.write("\n");
    };

    return bar;
};

vmake.release = function (target, config) {
    if (target.target_type != "static") {
        vmake.error("function vmake.release only support static target build");
        return false;
    }
    if (!config.includefiles || !config.version || !config.repo) {
        vmake.error("config error. vmake.release example: %s", `

    vmake.release(target, {
        includefiles: ["json.h"],  // location relative to src directory
        version: "1.1.0",
        repo: "http://119.29.164.225:19901/vmake-repo",
    });        

        `);
        return false;
    }
    let includefiles = config.includefiles;
    let version = config.version;
    let repo = config.repo;
    vmake.rm(".publish");
    vmake.mkdirs(".publish");
    vmake.run("vmake publish", ".publish");
    vmake.copy(target.target_dir + "/lib" + target.target_name + ".a", ".publish/lib" + "/lib" + target.target_name + ".a");
    for (const it of includefiles) {
        vmake.copy("src/" + it, ".publish/include/" + it);
    }
    vmake.copy("src/", ".publish/src", (source) => {
        if (source.endsWith(".cpp")) {
            return true;
        }
        return false;
    });
    const fs = require("fs");
    fs.writeFileSync(".publish/vmakepkg.json", JSON.stringify({
        name: target.target_name,
        version: version,
        repo: repo
    }, null, 4));
    vmake.run("vmake publish", ".publish");
    vmake.rm(".publish");
};
