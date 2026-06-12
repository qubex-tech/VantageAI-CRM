import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental LabTurnarounds API */
export declare class LabTurnaroundsService extends BaseDomainService {
    protected readonly resourcePath = "labturnarounds";
    /** GET /labturnarounds */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /labturnarounds */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=LabTurnaroundsService.d.ts.map