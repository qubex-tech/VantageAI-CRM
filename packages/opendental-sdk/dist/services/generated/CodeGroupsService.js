"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGroupsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental CodeGroups API */
class CodeGroupsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'codegroups';
    /** GET /codegroups */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.CodeGroupsService = CodeGroupsService;
//# sourceMappingURL=CodeGroupsService.js.map