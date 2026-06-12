import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Statements API */
export class StatementsService extends BaseDomainService {
  protected readonly resourcePath = 'statements'

  /** GET /statements */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** POST /statements */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** DELETE /{id} */
  async delete(id: string | number): Promise<unknown> {
    return this.removeRecord(id)
  }
}
