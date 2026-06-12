"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Sheets API */
class SheetsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'sheets';
    /** GET /sheets */
    async list(params) {
        return this.getList(params);
    }
    /** POST /sheets */
    async create(body) {
        return this.createRecord(body);
    }
    /** POST /downloadsftp */
    async downloadSftp(body) {
        return this.postAction('downloadsftp', body);
    }
}
exports.SheetsService = SheetsService;
//# sourceMappingURL=SheetsService.js.map