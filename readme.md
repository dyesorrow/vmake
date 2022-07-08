
## 安装
通过github安装:
```sh
npm install -f -g git+https://github.com/dyesorrow/vmake
```
或者下载后通过本地安装
```sh
npm install -g .
```

##### 安装docker容器版本
基于ubuntu:20.04
```sh
curl -sL https://github.com/dyesorrow/vmake/raw/master/docker/install.sh | sudo bash -
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
    let target = vmake.cpp("app", "bin");

    target.add_cxxflag("-g");
    target.add_cxxflag("-std=c++17");
    target.add_cxxflag("-Wall");
    target.add_cxxflag("-finput-charset=UTF-8");

    target.add_package("http://localhost:19901/vmake-repo", {
        "hutool-log": "1.1.0",
    });

    target.add_define("__DEBUG__");
    target.add_include("src");
    target.add_files("src/*.cpp");
    // target.add_objs("res/icon/icon.o");

    target.add_static_link("pthread");      // 添加静态链接库

    // target.add_ldflag("-static");        // 添加链接参数 
    // target.add_dynamic_link("pthread");  // 添加动态链接库
    // target.add_objs("res/icon/icon.o");  // 添加.o文件
    // target.set_multi_process(2);         // 设置构建是使用的进程数

    target.set_outdir("./");

    await target.build();
}; 
```

注意点：
1. 不支持依赖解决，需要自己手动全部导入
2. 只会把依赖的lib自动添加到链接，其他的如pthread需要手动添加
3. 目前支持 cpp 文件构建。如果是 .c 文件请单独构建，然后打成依赖包；或者构建成 obj 文件通过 add_objs 函数添加进来
4. 默认构建使用一半的核心数量的进程。如果需要自己指定进程数，添加-j参数即可： `vmake -j4` 或者  `vmake -j 4`




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