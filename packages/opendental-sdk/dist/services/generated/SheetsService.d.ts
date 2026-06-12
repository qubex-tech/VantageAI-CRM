import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Sheets API */
export declare class SheetsService extends BaseDomainService {
    protected readonly resourcePath = "sheets";
    /** GET /sheets */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /sheets */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** POST /downloadsftp */
    downloadSftp(body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=SheetsService.d.ts.map