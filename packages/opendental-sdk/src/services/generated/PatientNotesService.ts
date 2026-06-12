import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental PatientNotes API */
export class PatientNotesService extends BaseDomainService {
  protected readonly resourcePath = 'patientnotes'

  /** GET /patientnotes */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
