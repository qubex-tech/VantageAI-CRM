import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental RecallTypes API */
export declare class RecallTypesService extends BaseDomainService {
    protected readonly resourcePath = "recalltypes";
    /** GET /recalltypes */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=RecallTypesService.d.ts.map