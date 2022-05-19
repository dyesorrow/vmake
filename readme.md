
## 安装
通过github安装:
```sh
npm install -f -g git+https://github.com/dyesorrow/vmake
```
或者下载后通过本地安装
```sh
npm install -g .
```

## 使用

1. 初始化项目
    ```sh
    cd your-project-dir
    vmake init
    ```
2. 根据项目需要修改vmake.js

3. 构建
    ```sh
    vmake
    ```
    或者 
    ```sh
    vmake [task]
    ```

## vmake.js
```js
vmake.task.build = async function () {
    let target = vmake.build("app", "bin");

    target.add_cxxflag("-g");
    target.add_cxxflag("-std=c++17");
    target.add_cxxflag("-Wall");
    target.add_cxxflag("-Wno-write-strings -Wno-unused-parameter -Wno-sign-compare -Wno-format-security");
    target.add_cxxflag("-finput-charset=UTF-8");
    target.add_cxxflag("-Wextra");

    target.add_package("http://localhost:19901/vmake-repo", {
        "log": "1.0.0",
        "json": "1.0.0",
    });

    target.add_define("__DEBUG__");
    target.add_include("src");
    target.add_files("src/*.cpp");
    // target.add_objs("res/icon/icon.o");

    target.add_ldflag("-static -lpthread");
    // target.add_ldflag("-ldl -lrt -pthread -Wl,--whole-archive -lpthread -Wl,--no-whole-archive");

    target.set_outdir("./");

    await target.build();
}; 
```

注意点：
1. 不支持依赖解决，需要自己手动全部导入
2. 只会把依赖的lib自动添加到链接，其他的如pthread需要手动添加
3. 目前支持 cpp 文件构建。如果是 .c 文件请单独构建，然后打成依赖包；或者构建成 obj 文件通过 add_objs 函数添加进来


## 依赖包构建

执行如下命令生成依赖包目录
```sh
mkdir pkg-dir
vmake publish
```

修改补充一下内容即可提交
```sh
./include       # 头文件位置
./lib           # 生成的lib文件位置
./bin           # 资源文件位置，如 xxx.dll, xxx.html 等，会复制到执行目录
./src           # 源文件位置，提供开源内容
vmakepkg.json   # 配置信息
```
平台不提供修改，根据nodejs的 os.platform() 自动获取。即上传 windows的包需要在windows平台下，上传linux的包需要在linux平台下。

再次执行即可提交
```sh
vmake publish
```

上传的仓库只需要支持 Put 上传，Get 下载的web服务即可