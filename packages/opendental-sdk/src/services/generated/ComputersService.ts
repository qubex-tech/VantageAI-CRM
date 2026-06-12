import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Computers API */
export class ComputersService extends BaseDomainService {
  protected readonly resourcePath = 'computers'

  /** GET /computers */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
