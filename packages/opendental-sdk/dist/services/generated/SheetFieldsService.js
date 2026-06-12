"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetFieldsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental SheetFields API */
class SheetFieldsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'sheetfields';
    /** GET /sheetfields */
    async list(params) {
        return this.getList(params);
    }
}
exports.SheetFieldsService = SheetFieldsService;
//# sourceMappingURL=SheetFieldsService.js.map