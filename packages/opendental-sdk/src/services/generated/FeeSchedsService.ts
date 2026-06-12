import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental FeeScheds API */
export class FeeSchedsService extends BaseDomainService {
  protected readonly resourcePath = 'feescheds'

  /** GET /feescheds */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /feescheds */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
