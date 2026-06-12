import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental PatPlans API */
export class PatPlansService extends BaseDomainService {
  protected readonly resourcePath = 'patplans'

  /** GET /patplans */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /patplans */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** DELETE /{id} */
  async delete(id: string | number): Promise<unknown> {
    return this.removeRecord(id)
  }
}
