import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental EobAttaches API */
export declare class EobAttachesService extends BaseDomainService {
    protected readonly resourcePath = "eobattaches";
    /** GET /eobattaches */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /eobattaches */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** DELETE /{id} */
    delete(id: string | number): Promise<unknown>;
    /** POST /downloadsftp */
    downloadSftp(body: Record<string, unknown>): Promise<unknown>;
    /** POST /uploadsftp */
    uploadSftp(body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=EobAttachesService.d.ts.map