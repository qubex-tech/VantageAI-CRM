"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Documents API */
class DocumentsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'documents';
    /** GET /documents */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /upload */
    async upload(body) {
        return this.postAction('upload', body);
    }
    /** POST /downloadsftp */
    async downloadSftp(body) {
        return this.postAction('downloadsftp', body);
    }
    /** POST /setbyurl */
    async setByUrl(body) {
        return this.postAction('setbyurl', body);
    }
    /** POST /uploadsftp */
    async uploadSftp(body) {
        return this.postAction('uploadsftp', body);
    }
    /** POST /thumbnails */
    async thumbnails(body) {
        return this.postAction('thumbnails', body);
    }
    /** POST /downloadmount */
    async downloadMount(body) {
        return this.postAction('downloadmount', body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
}
exports.DocumentsService = DocumentsService;
//# sourceMappingURL=DocumentsService.js.map