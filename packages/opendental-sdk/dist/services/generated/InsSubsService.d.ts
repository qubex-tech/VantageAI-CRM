import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental InsSubs API */
export declare class InsSubsService extends BaseDomainService {
    protected readonly resourcePath = "inssubs";
    /** POST /inssubs */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=InsSubsService.d.ts.map