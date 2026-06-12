import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Reports API */
export class ReportsService extends BaseDomainService {
  protected readonly resourcePath = 'reports'

  /** GET /reports/aging */
  async getAging(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('aging', params)
  }

  /** GET /reports/financecharges */
  async getFinanceCharges(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('financecharges', params)
  }
}
