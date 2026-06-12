import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental UserGroupAttaches API */
export class UserGroupAttachesService extends BaseDomainService {
  protected readonly resourcePath = 'usergroupattaches'

  /** GET /usergroupattaches */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
