import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental DiseaseDefs API */
export declare class DiseaseDefsService extends BaseDomainService {
    protected readonly resourcePath = "diseasedefs";
    /** GET /diseasedefs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /diseasedefs */
    create(body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=DiseaseDefsService.d.ts.map