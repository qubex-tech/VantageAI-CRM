"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoNotesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental AutoNotes API */
class AutoNotesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'autonotes';
    /** GET /autonotes */
    async list(params) {
        return this.getList(params);
    }
    /** POST /autonotes */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.AutoNotesService = AutoNotesService;
//# sourceMappingURL=AutoNotesService.js.map