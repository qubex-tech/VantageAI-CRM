import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ChartModules API */
export class ChartModulesService extends BaseDomainService {
  protected readonly resourcePath = 'chartmodules'

  /** GET /chartmodules/prognotes */
  async getProgNotes(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('prognotes', params)
  }

  /** GET /chartmodules/patientinfo */
  async getPatientInfo(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('patientinfo', params)
  }

  /** GET /chartmodules/plannedappts */
  async getPlannedAppts(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('plannedappts', params)
  }
}
