import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Medications API */
export declare class MedicationsService extends BaseDomainService {
    protected readonly resourcePath = "medications";
    /** GET /medications */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /medications */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=MedicationsService.d.ts.map