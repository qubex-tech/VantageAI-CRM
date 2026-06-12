"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoNoteControlsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental AutoNoteControls API */
class AutoNoteControlsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'autonotecontrols';
    /** GET /autonotecontrols */
    async list(params) {
        return this.getList(params);
    }
    /** POST /autonotecontrols */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.AutoNoteControlsService = AutoNoteControlsService;
//# sourceMappingURL=AutoNoteControlsService.js.map