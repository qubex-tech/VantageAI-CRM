import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ToothInitials API */
export class ToothInitialsService extends BaseDomainService {
  protected readonly resourcePath = 'toothinitials'

  /** GET /toothinitials */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /toothinitials */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** DELETE /{id} */
  async delete(id: string | number): Promise<unknown> {
    return this.removeRecord(id)
  }
}
