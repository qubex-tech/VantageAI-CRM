import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Clinics API */
export declare class ClinicsService extends BaseDomainService {
    protected readonly resourcePath = "clinics";
    /** GET /clinics */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ClinicsService.d.ts.map