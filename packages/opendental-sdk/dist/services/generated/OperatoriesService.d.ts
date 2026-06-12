import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Operatories API */
export declare class OperatoriesService extends BaseDomainService {
    protected readonly resourcePath = "operatories";
    /** GET /operatories */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=OperatoriesService.d.ts.map