import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Userods API */
export class UserodsService extends BaseDomainService {
  protected readonly resourcePath = 'userods'

  /** GET /userods */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /userods */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
