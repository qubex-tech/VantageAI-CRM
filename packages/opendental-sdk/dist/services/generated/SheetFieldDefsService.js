"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetFieldDefsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental SheetFieldDefs API */
class SheetFieldDefsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'sheetfielddefs';
    /** GET /sheetfielddefs */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.SheetFieldDefsService = SheetFieldDefsService;
//# sourceMappingURL=SheetFieldDefsService.js.map