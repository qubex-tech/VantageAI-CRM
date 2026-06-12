import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental SecurityPerms API */
export class SecurityPermsService extends BaseDomainService {
  protected readonly resourcePath = 'securityperms'

  /** GET /securityperms */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
