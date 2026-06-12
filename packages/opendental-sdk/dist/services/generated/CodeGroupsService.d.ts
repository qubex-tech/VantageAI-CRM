import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental CodeGroups API */
export declare class CodeGroupsService extends BaseDomainService {
    protected readonly resourcePath = "codegroups";
    /** GET /codegroups */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=CodeGroupsService.d.ts.map