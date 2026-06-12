"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueriesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Queries API */
class QueriesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'queries';
    /** POST /queries */
    async post(body) {
        return this.createRecord(body);
    }
    /** PUT /shortquery */
    async shortQuery(body) {
        return this.updateSubResource('shortquery', body);
    }
}
exports.QueriesService = QueriesService;
//# sourceMappingURL=QueriesService.js.map