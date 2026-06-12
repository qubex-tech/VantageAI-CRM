import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Preferences API */
export class PreferencesService extends BaseDomainService {
  protected readonly resourcePath = 'preferences'

  /** GET /preferences */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
