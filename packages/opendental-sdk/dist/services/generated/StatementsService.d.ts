import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Statements API */
export declare class StatementsService extends BaseDomainService {
    protected readonly resourcePath = "statements";
    /** GET /statements */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /statements */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=StatementsService.d.ts.map