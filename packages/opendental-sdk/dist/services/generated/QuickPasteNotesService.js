"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickPasteNotesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental QuickPasteNotes API */
class QuickPasteNotesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'quickpastenotes';
    /** GET /quickpastenotes */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.QuickPasteNotesService = QuickPasteNotesService;
//# sourceMappingURL=QuickPasteNotesService.js.map