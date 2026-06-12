import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental AutoNoteControls API */
export declare class AutoNoteControlsService extends BaseDomainService {
    protected readonly resourcePath = "autonotecontrols";
    /** GET /autonotecontrols */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
    /** POST /autonotecontrols */
    create(body: Record<string, unknown>): Promise<unknown>;
    /** PUT /{id} */
    update(id: string | number, body: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=AutoNoteControlsService.d.ts.map