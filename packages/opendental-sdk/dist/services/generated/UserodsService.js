"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserodsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Userods API */
class UserodsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'userods';
    /** GET /userods */
    async list(params) {
        return this.getList(params);
    }
    /** POST /userods */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.UserodsService = UserodsService;
//# sourceMappingURL=UserodsService.js.map