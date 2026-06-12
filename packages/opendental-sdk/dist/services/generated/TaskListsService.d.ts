import { BaseDomainService } from '../base/BaseDomainService';
/** Open Dental TaskLists API */
export declare class TaskListsService extends BaseDomainService {
    protected readonly resourcePath = "tasklists";
    /** GET /tasklists */
    list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown>;
}
//# sourceMappingURL=TaskListsService.d.ts.map