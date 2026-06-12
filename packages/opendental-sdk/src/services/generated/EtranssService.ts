import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Etranss API */
export class EtranssService extends BaseDomainService {
  protected readonly resourcePath = 'etranss'

  /** GET /etranss */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
