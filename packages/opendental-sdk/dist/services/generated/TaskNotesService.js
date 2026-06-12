"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskNotesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental TaskNotes API */
class TaskNotesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'tasknotes';
    /** GET /tasknotes */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /tasknotes */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.TaskNotesService = TaskNotesService;
//# sourceMappingURL=TaskNotesService.js.map