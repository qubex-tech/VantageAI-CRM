import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Subscriptions API */
export declare class SubscriptionsService extends BaseDomainService {
    protected readonly resourcePath = "subscriptions";
    /** GET /subscriptions */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /subscriptions */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=SubscriptionsService.d.ts.map