import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Popups API */
export declare class PopupsService extends BaseDomainService {
    protected readonly resourcePath = "popups";
    /** GET /popups */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /popups */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=PopupsService.d.ts.map