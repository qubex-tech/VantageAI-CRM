import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Recalls API */
export declare class RecallsService extends BaseDomainService {
    protected readonly resourcePath = "recalls";
    /** GET /recalls */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /list */
    getList2(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /recalls */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/status */
    updateStatus(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id}/switchtype */
    switchType(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=RecallsService.d.ts.map