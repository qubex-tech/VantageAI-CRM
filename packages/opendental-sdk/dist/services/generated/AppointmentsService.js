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
    /** GET /slotswebsched */
    async getSlotsWebSched(params) {
        return this.getSubResource('slotswebsched', params);
    }
    /** GET /slots */
    async getSlots(params) {
        return this.getSubResource('slots', params);
    }
    /** GET /asap */
    async getASAP(params) {
        return this.getSubResource('asap', params);
    }
    /** GET /websched */
    async getWebSched(params) {
        return this.getSubResource('websched', params);
    }
    /** POST /appointments */
    async create(body) {
        return this.createRecord(body);
    }
    /** POST /planned */
    async createPlanned(body) {
        return this.postAction('planned', body);
    }
    /** POST /scheduleplanned */
    async createSchedulePlanned(body) {
        return this.postAction('scheduleplanned', body);
    }
    /** POST /websched */
    async createWebSched(body) {
        return this.postAction('websched', body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
    /** PUT /{id}/break */
    async break(id, body) {
        return this.updateRecord(id, body);
    }
    /** PUT /{id}/confirm */
    async confirm(id, body) {
        return this.updateRecord(id, body);
    }
    /** PUT /{id}/note */
    async updateNote(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.AppointmentsService = AppointmentsService;
//# sourceMappingURL=AppointmentsService.js.map