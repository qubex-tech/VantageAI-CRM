import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental QuickPasteCats API */
export class QuickPasteCatsService extends BaseDomainService {
  protected readonly resourcePath = 'quickpastecats'

  /** GET /quickpastecats */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }
}
