import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ProcNotes API */
export class ProcNotesService extends BaseDomainService {
  protected readonly resourcePath = 'procnotes'

  /** GET /procnotes */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /procnotes */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }
}
