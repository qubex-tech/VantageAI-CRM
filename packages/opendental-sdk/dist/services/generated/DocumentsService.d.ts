import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental Documents API */
export declare class DocumentsService extends BaseDomainService {
    protected readonly resourcePath = "documents";
    /** GET /documents */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** GET /{id} */
    get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
    /** POST /upload */
    upload(body: Record<string, unknown>): Promise<unknown>;
    /** POST /downloadsftp */
    downloadSftp(body: Record<string, unknown>): Promise<unknown>;
    /** POST /setbyurl */
    setByUrl(body: Record<string, unknown>): Promise<unknown>;
    /** POST /uploadsftp */
    uploadSftp(body: Record<string, unknown>): Promise<unknown>;
    /** POST /thumbnails */
    thumbnails(body: Record<string, unknown>): Promise<unknown>;
    /** POST /downloadmount */
    downloadMount(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
}
//# sourceMappingURL=DocumentsService.d.ts.map