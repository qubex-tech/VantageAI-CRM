import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental TaskLists API */
export class TaskListsService extends BaseDomainService {
  protected readonly resourcePath = 'tasklists'

  /** GET /tasklists */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
