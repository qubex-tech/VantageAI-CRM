import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Appointments API */
export declare class AppointmentsService extends BaseDomainService {
    protected readonly resourcePath = "appointments";
    /** GET /appointments */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** GET /slotswebsched */
    getSlotsWebSched(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /slots */
    getSlots(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /asap */
    getASAP(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /websched */
    getWebSched(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /appointments */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** POST /planned */
    createPlanned(body: Record<string, unknown>): Promise<unknown>;
    /** POST /scheduleplanned */
    createSchedulePlanned(body: Record<string, unknown>): Promise<unknown>;
    /** POST /websched */
    createWebSched(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/break */
    break(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/confirm */
    confirm(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/note */
    updateNote(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=AppointmentsService.d.ts.map