import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental AsapComms API */
export declare class AsapCommsService extends BaseDomainService {
    protected readonly resourcePath = "asapcomms";
    /** GET /asapcomms */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /asapcomms */
    create(body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=AsapCommsService.d.ts.map