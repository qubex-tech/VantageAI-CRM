import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ClaimProcs API */
export class ClaimProcsService extends BaseDomainService {
  protected readonly resourcePath = 'claimprocs'

  /** GET /claimprocs */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** POST /insadjust */
  async createInsAdjust(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('insadjust', body)
  }

  /** PUT /insadjust */
  async updateInsAdjust(body: Record<string, unknown>): Promise<unknown> {
    return this.updateSubResource<Record<string, unknown>>('insadjust', body)
  }

  /** POST /supplemental */
  async createSupplemental(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('supplemental', body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
