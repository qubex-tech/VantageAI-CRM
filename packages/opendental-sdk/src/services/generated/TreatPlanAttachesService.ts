import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental TreatPlanAttaches API */
export class TreatPlanAttachesService extends BaseDomainService {
  protected readonly resourcePath = 'treatplanattaches'

  /** GET /treatplanattaches */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
