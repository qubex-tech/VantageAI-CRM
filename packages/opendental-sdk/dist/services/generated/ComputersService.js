"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputersService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Computers API */
class ComputersService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'computers';
    /** GET /computers */
    async list(params) {
        return this.getList(params);
    }
}
exports.ComputersService = ComputersService;
//# sourceMappingURL=ComputersService.js.map