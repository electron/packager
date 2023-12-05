"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractElectronZip = void 0;
const extract_zip_1 = __importDefault(require("extract-zip"));
async function extractElectronZip(zipPath, targetDir) {
    await (0, extract_zip_1.default)(zipPath, { dir: targetDir });
}
exports.extractElectronZip = extractElectronZip;
//# sourceMappingURL=unzip.js.map