"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = exports.LinuxApp = void 0;
const platform_1 = require("./platform");
const common_1 = require("./common");
class LinuxApp extends platform_1.App {
    get originalElectronName() {
        return 'electron';
    }
    get newElectronName() {
        return (0, common_1.sanitizeAppName)(this.executableName);
    }
    async create() {
        await this.initialize();
        await this.renameElectron();
        await this.copyExtraResources();
        return this.move();
    }
}
exports.LinuxApp = LinuxApp;
exports.App = LinuxApp;
//# sourceMappingURL=linux.js.map