import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Definitions API */
export class DefinitionsService extends BaseDomainService {
  protected readonly resourcePath = 'definitions'

  /** GET /definitions */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /definitions */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }
}
