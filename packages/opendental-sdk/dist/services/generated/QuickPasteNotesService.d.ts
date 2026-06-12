import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental QuickPasteNotes API */
export declare class QuickPasteNotesService extends BaseDomainService {
    protected readonly resourcePath = "quickpastenotes";
    /** GET /quickpastenotes */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
}
//# sourceMappingURL=QuickPasteNotesService.d.ts.map