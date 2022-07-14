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

const fs = require("fs");
const os = require("os");

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
        vmake.error(" vmake.release 函数只支持静态链接库的打包");
        return false;
    }
    if (!config || !config.includefiles || !config.version || !config.repo) {
        vmake.error("vmake.release 使用错误，缺少必要参数。 正确示例如下: %s", `

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
        vmake.log("无源文件进行拷贝.");
    }

    let includefiles = config.includefiles;
    let sourcefiles = config.sourcefiles || [];
    let version = config.version;
    let repo = config.repo;

    vmake.rm(".publish");
    vmake.mkdirs(".publish");
    vmake.run("vmake publish", ".publish");

    let static_result_name = target.target_dir + "/lib" + target.target_name + ".a";
    if (fs.existsSync(static_result_name)) {
        vmake.copy(static_result_name, ".publish/lib" + "/lib" + target.target_name + ".a");
    } else {
        vmake.warn("不存在静态连接结果文件. 已忽略复制: %s", static_result_name);
    }
    vmake.copy(target.build_dir + "/lib/dependencies.json", ".publish/dependencies.json");

    // 拷贝头文件
    vmake.copy("src/", ".publish/include", (source) => {
        for (const it of includefiles) {
            if (vmake.wildcard_test(it, source)) {
                vmake.info("[复制include]: %s", source);
                return true;
            }
        }
        return false;
    });

    // 拷贝源代码
    vmake.copy("src/", ".publish/src", (source) => {
        for (const it of sourcefiles) {
            if (vmake.wildcard_test(it, source)) {
                vmake.info("[复制src]: %s", source);
                return true;
            }
        }
        return false;
    });

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
        vmake.warn("路径已经存在文件或者文件夹: %s", path);
        let answer = await inquirer.prompt({ message: "继续使用 ? (y/n)", name: "input" });
        if (answer.input.toUpperCase() == "N") {
            vmake.rm(path);
            await not_reuse_callbcak();
        }
    } else {
        await not_reuse_callbcak();
    }
};

vmake.ask = async function (question, default_input) {
    const inquirer = vmake.module["inquirer"];
    let answer = await inquirer.prompt({ message: question + " ? (y/n)", name: "input" });
    if (!answer.input || answer.input == "") {
        answer.input == default_input;
    }
    if (answer.input.toUpperCase() == "Y") {
        return true;
    }
    if (answer.input.toUpperCase() == "N") {
        return false;
    }
    vmake.error("请输入 Y 或者 N");
    return await vmake.ask(question);
};

vmake.require = async function (url) {
    let name = url.substring(url.lastIndexOf("/") + 1);
    let dist_path = os.tmpdir() + "/vmake/script/" + name;
    try {
        await vmake.download(url, dist_path);
    } catch (error) {
        vmake.warn("下载错误: " + url);
    }
    return require(path.join(process.cwd(), dist_path));
};



/**
 * 一个简洁的不关注性能的模板函数，使用示例如下：
 * ```
 * vmake.render(`
 * #include "text.h"
 * 
 * <%
 * for(let inc of includes){
 *     <@
 *     #include "#{it}" @>
 * }
 * %>
 * `, {includes: [
 *     "test.h"
 * ]})
 * ```
 * @param {*} tmpl 
 * @param {*} data 
 * @returns 
 */

vmake.render = function (tmpl, data) {
    let resultStr = "";
    let print = function (text) {
        resultStr += text;
    };
    let functionStr = "";
    let textType = "text";

    let beforeIsWrap = false;
    let spaceCount = 0;

    for (let i = 0; i < tmpl.length; i++) {
        if (tmpl.charAt(i) === '<' && tmpl.charAt(i + 1) === '%') {
            if (beforeIsWrap && spaceCount > 0) {
                resultStr = resultStr.substring(0, resultStr.length - spaceCount); // 剔除多余的空格
            }
            functionStr = "";
            textType = "func";
            i += 2;
        }
        if (tmpl.charAt(i) === '%' && tmpl.charAt(i + 1) === '>') {
            functionStr = functionStr.replaceAll(/#\{(.+?)\}/g, "${$1}");
            functionStr = functionStr.replaceAll(/([ ]*)<@( *\n)?([\S\s]*?)@>/g, function (m, p1, p2, p3) {
                p3 = p3 || p2;
                let lines = p3.split("\n");
                if (p2 && lines.length > 1) {
                    lines[0] = lines[0].substring(p1.length);
                }
                for (let i = 1; i < lines.length; i++) {
                    lines[i] = lines[i].substring(p1.length);
                }
                let output = "print(`" + lines.join("\n") + "`);";
                output = output.replaceAll(/#\{(.+?)\}/g, "${$1}");
                return output;
            });


            let argNames = [];
            let valParas = [];
            for (const key in data) {
                argNames.push(key);
                valParas.push("data." + key);
            }
            let exeStr = `function __function( ${argNames.join(", ")} ){ ${functionStr} }; __function(${valParas.join(", ")});`;
            eval(exeStr);
            textType = "text";
            i += 2;

            for (; i < tmpl.length; i++) {
                if (tmpl.charAt(i) === ' ') {
                    continue;
                }
                if (tmpl.charAt(i) === "\n") {
                    i++;
                }
                break;
            }
        }
        if (tmpl.charAt(i) === '\n') {
            beforeIsWrap = true;
        }
        if (tmpl.charAt(i) !== '\n' && tmpl.charAt(i) !== ' ') {
            beforeIsWrap = false;
        }
        if (tmpl.charAt(i) === ' ') {
            spaceCount++;
        } else {
            spaceCount = 0;
        }

        if (textType == "text") {
            resultStr += tmpl.charAt(i);
        }
        if (textType == "func") {
            functionStr += tmpl.charAt(i);
        }

    }
    return resultStr;
};

vmake.big_hump = function (str) {
    return vmake.hump(str, true);
};

vmake.hump = function (str, firstup) {
    let result = "";
    let upnext = false;
    for (let i = 0; i < str.length; i++) {
        let char = str.charAt(i);
        if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char >= '0' && char <= '9') {
            if (result == "") {
                if (firstup) {
                    result += ("" + char).toUpperCase();
                } else {
                    result += ("" + char).toLowerCase();
                }
            }
            else if (upnext) {
                result += ("" + char).toUpperCase();
            } else {
                result += char;
            }
            upnext = false;
        } else {
            upnext = true;
        }
    }
    return result;
};


vmake.gccVersion = function () {
    const exec = require("child_process").spawnSync;
    let output = exec("g++", ["-v"]);

    let reg = /gcc version (.+?) \((MinGW-.+?), built by (.+?)\)/g;
    let rst = reg.exec(output.stderr);
    if (rst) {
        return {
            version: rst[1],
            target: rst[2],
            author: rst[3]
        };
    }
};