import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental AppointmentTypes API */
export class AppointmentTypesService extends BaseDomainService {
  protected readonly resourcePath = 'appointmenttypes'

  /** GET /appointmenttypes */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }
}
