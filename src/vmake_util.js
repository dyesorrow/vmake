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


vmake.wildcard_test = function (wildcard_str, source_str) {
    // https://leetcode.cn/problems/wildcard-matching/solution/js-dong-tai-gui-hua-yu-hui-su-by-jsyt/
    let s = source_str;
    let p = wildcard_str;
    if (p === "*" || s === p) return true;
    let dp = Array.from(Array(s.length + 1), _ => Array(p.length + 1).fill(false));
    dp[0][0] = true;
    for (let i = 1; i <= p.length; i++) {
        if (!dp[0][i - 1]) break;
        if (p[i - 1] === '*') dp[0][i] = true;
    }
    for (let i = 1; i <= s.length; i++) {
        for (let j = 1; j <= p.length; j++) {
            if (s[i - 1] === p[j - 1] || p[j - 1] === "?") {
                dp[i][j] = dp[i - 1][j - 1];
            } else if (p[j - 1] === "*") {
                dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
            }
        }
    }
    return dp[s.length][p.length];
};

vmake.release = function (target, config) {
    if (!target || target.target_type != "static") {
        vmake.error("function vmake.release only support static target build");
        return false;
    }
    if (!config || !config.includefiles || !config.version || !config.repo) {
        vmake.error("function vmake.release use error. right example: %s", `

vmake.release(target, {
    includefiles: [
        "src/json.h"
    ],
    sourcefiles: [
        "src/*.cpp"
    ],
    version: "1.1.0",
    repo: "http://127.0.0.1:19901/vmake-repo",
});
        `);
        process.exit(-1);
    }

    if (!config.sourcefiles) {
        vmake.info("no source files will be copy.");
    }

    let includefiles = config.includefiles;
    let sourcefiles = config.sourcefiles || [];
    let version = config.version;
    let repo = config.repo;

    vmake.rm(".publish");
    vmake.mkdirs(".publish");
    vmake.run("vmake publish", ".publish");
    vmake.copy(target.target_dir + "/lib" + target.target_name + ".a", ".publish/lib" + "/lib" + target.target_name + ".a");
    vmake.copy(target.build_dir + "/lib/dependencies.json", ".publish/dependencies.json");

    // 拷贝头文件
    vmake.copy("src/", ".publish/include", (source) => {
        for (const it of includefiles) {
            if (vmake.wildcard_test(it, source)) {
                vmake.info("[include copy]: %s", source);
                return true;
            }
        }
        return false;
    });

    // 拷贝源代码
    vmake.copy("src/", ".publish/src", (source) => {
        for (const it of sourcefiles) {
            if (vmake.wildcard_test(it, source)) {
                vmake.info("[source  copy]: %s", source);
                return true;
            }
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

vmake.ask_reuse = async function (path, not_reuse_callbcak) {
    const inquirer = vmake.module["inquirer"];
    const fs = require("fs");
    if (fs.existsSync(path)) {
        vmake.warn("Path exist: %s", path);
        let answer = await inquirer.prompt({ message: "reuse it ? (y/n)", name: "input" });
        if (answer.input.toUpperCase() == "N") {
            vmake.rm(path);
            await not_reuse_callbcak();
        }
    }
};

vmake.ask = async function (question) {
    let answer = await inquirer.prompt({ message: question + " ? (y/n)", name: "input" });
    if (answer.input.toUpperCase() == "Y" || answer.input == "") {
        return true;
    }
    if (answer.input.toUpperCase() == "N") {
        return false;
    }
    vmake.error("please input Y or N");
    return await vmake.ask(question);
};
