import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental SheetDefs API */
export class SheetDefsService extends BaseDomainService {
  protected readonly resourcePath = 'sheetdefs'

  /** GET /sheetdefs */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }
}
