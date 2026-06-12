import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Claims API */
export class ClaimsService extends BaseDomainService {
  protected readonly resourcePath = 'claims'

  /** GET /claims */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** POST /claims */
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

  /** PUT /{id}/status */
  async updateStatus(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** PUT /{id}/split */
  async split(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
