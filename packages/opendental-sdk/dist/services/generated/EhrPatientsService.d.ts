import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental EhrPatients API */
export declare class EhrPatientsService extends BaseDomainService {
    protected readonly resourcePath = "ehrpatients";
    /** GET /ehrpatients */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=EhrPatientsService.d.ts.map