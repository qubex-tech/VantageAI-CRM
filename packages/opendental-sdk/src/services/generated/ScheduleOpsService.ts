import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ScheduleOps API */
export class ScheduleOpsService extends BaseDomainService {
  protected readonly resourcePath = 'scheduleops'

  /** GET /scheduleops */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
