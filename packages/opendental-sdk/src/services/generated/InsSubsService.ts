import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental InsSubs API */
export class InsSubsService extends BaseDomainService {
  protected readonly resourcePath = 'inssubs'

  /** POST /inssubs */
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
