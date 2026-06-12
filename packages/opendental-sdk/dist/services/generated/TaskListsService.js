"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskListsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental TaskLists API */
class TaskListsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'tasklists';
    /** GET /tasklists */
    async list(params) {
        return this.getList(params);
    }
}
exports.TaskListsService = TaskListsService;
//# sourceMappingURL=TaskListsService.js.map