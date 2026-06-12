"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetDefsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental SheetDefs API */
class SheetDefsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'sheetdefs';
    /** GET /sheetdefs */
    async list(params) {
        return this.getList(params);
    }
}
exports.SheetDefsService = SheetDefsService;
//# sourceMappingURL=SheetDefsService.js.map