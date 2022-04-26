vmake.tasks.help = function(){
    console.log(`Usage: vmake [option] [params]...
Example: vmake init

Option:
    init                    初始化目录
    build [target]          构建目标
    publish                 发布包
    [user_task|target]      执行自定义命令, 或者构建目标

Report bugs to: dyesorrow@qq.com   
More help: https://github.com/dyesorrow/vmake
Version: 1.0 `);
}