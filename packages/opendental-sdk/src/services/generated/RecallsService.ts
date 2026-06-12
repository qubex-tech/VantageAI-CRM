import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Recalls API */
export class RecallsService extends BaseDomainService {
  protected readonly resourcePath = 'recalls'

  /** GET /recalls */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /list */
  async getList2(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('list', params)
  }

  /** POST /recalls */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** PUT /{id}/status */
  async updateStatus(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** PUT /{id}/switchtype */
  async switchType(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
