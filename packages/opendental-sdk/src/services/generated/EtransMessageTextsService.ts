import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental EtransMessageTexts API */
export class EtransMessageTextsService extends BaseDomainService {
  protected readonly resourcePath = 'etransmessagetexts'

  /** GET /etransmessagetexts */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
