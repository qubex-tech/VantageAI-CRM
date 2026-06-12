import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental HistAppointments API */
export class HistAppointmentsService extends BaseDomainService {
  protected readonly resourcePath = 'histappointments'

  /** GET /histappointments */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
