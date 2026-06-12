"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsapCommsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental AsapComms API */
class AsapCommsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'asapcomms';
    /** GET /asapcomms */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /asapcomms */
    async create(body) {
        return this.createRecord(body);
    }
}
exports.AsapCommsService = AsapCommsService;
//# sourceMappingURL=AsapCommsService.js.map