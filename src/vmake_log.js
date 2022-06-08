const printf = require("printf");

vmake.debug = function (fmt, ...args) {
    if (vmake.get_config("debug", false)) {
        console.log(fmt, ...args);
    }
}

vmake.log = function (fmt, ...args) {
    console.log(printf(fmt, ...args));;
}

vmake.info = function (fmt, ...args) {
    console.log(printf("\u001b[38;5;86m" + fmt + "\u001b[0m", ...args));;
}

vmake.warn = function (fmt, ...args) {
    console.log(printf("\u001b[1;33m" + fmt + "\u001b[0m", ...args));;
}

vmake.error = function (fmt, ...args) {
    console.log(printf("\u001b[1;31m" + fmt + "\u001b[0m", ...args));;
}

vmake.success = function (fmt, ...args) {
    console.log(printf("\u001b[1;32m" + fmt + "\u001b[0m", ...args));;
}
