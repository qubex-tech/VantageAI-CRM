import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Carriers API */
export declare class CarriersService extends BaseDomainService {
    protected readonly resourcePath = "carriers";
    /** GET /carriers */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /carriers */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=CarriersService.d.ts.map