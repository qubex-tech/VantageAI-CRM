import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental TreatPlans API */
export class TreatPlansService extends BaseDomainService {
  protected readonly resourcePath = 'treatplans'

  /** GET /treatplans */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /treatplans */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** POST /saved */
  async createSaved(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('saved', body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** DELETE /{id} */
  async delete(id: string | number): Promise<unknown> {
    return this.removeRecord(id)
  }
}
