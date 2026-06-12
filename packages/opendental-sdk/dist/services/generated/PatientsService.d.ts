import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Patients API */
export declare class PatientsService extends BaseDomainService {
    protected readonly resourcePath = "patients";
    /** GET /patients */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** GET /simple */
    getSimple(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /patients */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=PatientsService.d.ts.map