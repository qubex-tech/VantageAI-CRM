import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental MedicationPats API */
export class MedicationPatsService extends BaseDomainService {
  protected readonly resourcePath = 'medicationpats'

  /** GET /medicationpats */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /medicationpats */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** DELETE /{id} */
  async delete(id: string | number): Promise<unknown> {
    return this.removeRecord(id)
  }
}
