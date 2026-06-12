import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental PayPlanCharges API */
export class PayPlanChargesService extends BaseDomainService {
  protected readonly resourcePath = 'payplancharges'

  /** GET /payplancharges */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
