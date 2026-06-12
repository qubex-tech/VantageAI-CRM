import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental AccountModules API */
export class AccountModulesService extends BaseDomainService {
  protected readonly resourcePath = 'accountmodules'

  /** GET /accountmodules/aging */
  async getAging(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('aging', params)
  }

  /** GET /accountmodules/patientbalances */
  async getPatientBalances(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('patientbalances', params)
  }

  /** GET /accountmodules/servicedateview */
  async getServiceDateView(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('servicedateview', params)
  }
}
