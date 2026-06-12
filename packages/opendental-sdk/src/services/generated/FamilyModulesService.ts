import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental FamilyModules API */
export class FamilyModulesService extends BaseDomainService {
  protected readonly resourcePath = 'familymodules'

  /** GET /familymodules/insurance */
  async getInsurance(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('insurance', params)
  }
}
