import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ProcTPs API */
export class ProcTPsService extends BaseDomainService {
  protected readonly resourcePath = 'proctps'

  /** GET /proctps */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
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
