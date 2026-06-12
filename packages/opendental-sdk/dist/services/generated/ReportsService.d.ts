import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Reports API */
export declare class ReportsService extends BaseDomainService {
    protected readonly resourcePath = "reports";
    /** GET /reports/aging */
    getAging(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /reports/financecharges */
    getFinanceCharges(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
}
//# sourceMappingURL=ReportsService.d.ts.map