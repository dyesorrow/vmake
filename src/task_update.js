const path = require('path')

vmake.task.update = function(){
    vmake.run("git pull", path.dirname(__dirname));
    vmake.run("npm install", path.dirname(__dirname));
}