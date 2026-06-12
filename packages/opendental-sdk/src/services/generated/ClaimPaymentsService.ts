import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ClaimPayments API */
export class ClaimPaymentsService extends BaseDomainService {
  protected readonly resourcePath = 'claimpayments'

  /** GET /claimpayments */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** POST /claimpayments */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** POST /batch */
  async createBatch(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('batch', body)
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
