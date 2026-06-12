import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental SecurityLogs API */
export class SecurityLogsService extends BaseDomainService {
  protected readonly resourcePath = 'securitylogs'

  /** GET /securitylogs */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
