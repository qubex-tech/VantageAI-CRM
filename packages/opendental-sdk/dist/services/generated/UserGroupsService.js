"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGroupsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental UserGroups API */
class UserGroupsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'usergroups';
    /** GET /usergroups */
    async list(params) {
        return this.getList(params);
    }
}
exports.UserGroupsService = UserGroupsService;
//# sourceMappingURL=UserGroupsService.js.map