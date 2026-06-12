import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental SubstitutionLinks API */
export class SubstitutionLinksService extends BaseDomainService {
  protected readonly resourcePath = 'substitutionlinks'

  /** GET /substitutionlinks */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /substitutionlinks */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
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
