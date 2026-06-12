import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental ToothInitials API */
export declare class ToothInitialsService extends BaseDomainService {
    protected readonly resourcePath = "toothinitials";
    /** GET /toothinitials */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /toothinitials */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=ToothInitialsService.d.ts.map