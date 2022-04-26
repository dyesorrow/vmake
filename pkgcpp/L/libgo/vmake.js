vmake.tasks.libgo = () => {
    const fs = require("fs");
    const os = require("os");

    if (os.platform() != "linux") {
        vmake.error("only for linux, current platform: %s", os.platform());
        return;
    }

    const target = "libgo";

    if (fs.existsSync(target)) {
        vmake.warn("Target[%s] dir exist!", target);
    }
    vmake.mkdirs(target);
    process.chdir(target);

    vmake.info("[do download]");
    vmake.run("wget https://github.com/yyzybb537/libgo/archive/refs/tags/v2.6.tar.gz");

    vmake.info("[tar -xv v2.6.tar.gz]");
    vmake.rm("libgo-2.6");
    vmake.run("tar -xf v2.6.tar.gz");

    vmake.info("[do cmake]");
    vmake.run("mkdir build", "libgo-2.6");
    vmake.run("cmake ..", "libgo-2.6/build");

    vmake.info("[do make]");
    vmake.run("make", "libgo-2.6/build");

    vmake.info("[do publish]");
    vmake.mkdirs("publish");
    vmake.run("vmake publish", "publish");
    vmake.run("cp libgo-2.6/build/liblibgo.a publish/lib");
    vmake.run("cp libgo-2.6/libgo publish/include -r");
    fs.writeFileSync("publish/vmakepkg.json", JSON.stringify({
        "name": "libgo",
        "version": "2.6.0",
        "repo": vmake.get_config("repo", "http://localhost:19901/vmake-repo")
    }, null, 4));
    vmake.run("vmake publish", "publish");
}