import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental PatientRaces API */
export class PatientRacesService extends BaseDomainService {
  protected readonly resourcePath = 'patientraces'

  /** GET /patientraces */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
