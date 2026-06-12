import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental UserGroups API */
export class UserGroupsService extends BaseDomainService {
  protected readonly resourcePath = 'usergroups'

  /** GET /usergroups */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
