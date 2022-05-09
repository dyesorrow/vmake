const path = require('path')

vmake.task.update = function(){
    vmake.run("git pull", path.dirname(__dirname))
}