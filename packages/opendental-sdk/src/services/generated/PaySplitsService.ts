import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental PaySplits API */
export class PaySplitsService extends BaseDomainService {
  protected readonly resourcePath = 'paysplits'

  /** GET /paysplits */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
