"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcNotesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ProcNotes API */
class ProcNotesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'procnotes';
    /** GET /procnotes */
    async list(params) {
        return this.getList(params);
    }
    /** POST /procnotes */
    async create(body) {
        return this.createRecord(body);
    }
}
exports.ProcNotesService = ProcNotesService;
//# sourceMappingURL=ProcNotesService.js.map