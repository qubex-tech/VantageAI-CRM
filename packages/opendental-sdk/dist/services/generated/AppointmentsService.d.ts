import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Appointments API */
export declare class AppointmentsService extends BaseDomainService {
    protected readonly resourcePath = "appointments";
    /** GET /appointments */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** GET /SlotsWebSched */
    getSlotsWebSched(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /Slots */
    getSlots(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /ASAP */
    getASAP(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /WebSched */
    getWebSched(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /appointments */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** POST /Planned */
    createPlanned(body: Record<string, unknown>): Promise<unknown>;
    /** POST /SchedulePlanned */
    createSchedulePlanned(body: Record<string, unknown>): Promise<unknown>;
    /** POST /WebSched */
    createWebSched(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/Break */
    break(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/Confirm */
    confirm(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/Note */
    updateNote(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=AppointmentsService.d.ts.map