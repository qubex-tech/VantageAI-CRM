import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Sheets API */
export class SheetsService extends BaseDomainService {
  protected readonly resourcePath = 'sheets'

  /** GET /sheets */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /sheets */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** POST /downloadsftp */
  async downloadSftp(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('downloadsftp', body)
  }
}
