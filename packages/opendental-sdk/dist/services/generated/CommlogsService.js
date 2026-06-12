"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommlogsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Commlogs API */
class CommlogsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'commlogs';
    /** GET /commlogs */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /commlogs */
    async create(body) {
        return this.createRecord(body);
    }
}
exports.CommlogsService = CommlogsService;
//# sourceMappingURL=CommlogsService.js.map