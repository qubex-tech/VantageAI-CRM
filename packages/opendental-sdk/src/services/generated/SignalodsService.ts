import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Signalods API */
export class SignalodsService extends BaseDomainService {
  protected readonly resourcePath = 'signalods'

  /** GET /signalods */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
