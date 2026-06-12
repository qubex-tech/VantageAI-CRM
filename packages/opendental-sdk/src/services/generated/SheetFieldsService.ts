import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental SheetFields API */
export class SheetFieldsService extends BaseDomainService {
  protected readonly resourcePath = 'sheetfields'

  /** GET /sheetfields */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
