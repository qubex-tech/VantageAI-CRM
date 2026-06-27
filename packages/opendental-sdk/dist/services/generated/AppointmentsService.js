"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Appointments API */
class AppointmentsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'appointments';
    /** GET /appointments */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** GET /SlotsWebSched */
    async getSlotsWebSched(params) {
        return this.getSubResource('SlotsWebSched', params);
    }
    /** GET /Slots */
    async getSlots(params) {
        return this.getSubResource('Slots', params);
    }
    /** GET /ASAP */
    async getASAP(params) {
        return this.getSubResource('ASAP', params);
    }
    /** GET /WebSched */
    async getWebSched(params) {
        return this.getSubResource('WebSched', params);
    }
    /** POST /appointments */
    async create(body) {
        return this.createRecord(body);
    }
    /** POST /Planned */
    async createPlanned(body) {
        return this.postAction('Planned', body);
    }
    /** POST /SchedulePlanned */
    async createSchedulePlanned(body) {
        return this.postAction('SchedulePlanned', body);
    }
    /** POST /WebSched */
    async createWebSched(body) {
        return this.postAction('WebSched', body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
    /** PUT /{id}/Break */
    async break(id, body) {
        return this.updateSubResource(`${id}/Break`, body);
    }
    /** PUT /{id}/Confirm */
    async confirm(id, body) {
        return this.updateSubResource(`${id}/Confirm`, body);
    }
    /** PUT /{id}/Note */
    async updateNote(id, body) {
        return this.updateSubResource(`${id}/Note`, body);
    }
}
exports.AppointmentsService = AppointmentsService;
//# sourceMappingURL=AppointmentsService.js.map