"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGroupAttachesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental UserGroupAttaches API */
class UserGroupAttachesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'usergroupattaches';
    /** GET /usergroupattaches */
    async list(params) {
        return this.getList(params);
    }
}
exports.UserGroupAttachesService = UserGroupAttachesService;
//# sourceMappingURL=UserGroupAttachesService.js.map