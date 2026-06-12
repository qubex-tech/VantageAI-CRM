import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental SheetFieldDefs API */
export declare class SheetFieldDefsService extends BaseDomainService {
    protected readonly resourcePath = "sheetfielddefs";
    /** GET /sheetfielddefs */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=SheetFieldDefsService.d.ts.map