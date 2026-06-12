import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Providers API */
export declare class ProvidersService extends BaseDomainService {
    protected readonly resourcePath = "providers";
    /** GET /providers */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /providers */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ProvidersService.d.ts.map