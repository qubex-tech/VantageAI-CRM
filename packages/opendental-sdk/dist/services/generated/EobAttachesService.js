"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EobAttachesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental EobAttaches API */
class EobAttachesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'eobattaches';
    /** GET /eobattaches */
    async list(params) {
        return this.getList(params);
    }
    /** POST /eobattaches */
    async create(body) {
        return this.createRecord(body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
    /** POST /downloadsftp */
    async downloadSftp(body) {
        return this.postAction('downloadsftp', body);
    }
    /** POST /uploadsftp */
    async uploadSftp(body) {
        return this.postAction('uploadsftp', body);
    }
}
exports.EobAttachesService = EobAttachesService;
//# sourceMappingURL=EobAttachesService.js.map