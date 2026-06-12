import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Clinics API */
export class ClinicsService extends BaseDomainService {
  protected readonly resourcePath = 'clinics'

  /** GET /clinics */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
