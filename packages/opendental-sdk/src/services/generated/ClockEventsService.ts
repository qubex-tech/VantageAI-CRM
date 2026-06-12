import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ClockEvents API */
export class ClockEventsService extends BaseDomainService {
  protected readonly resourcePath = 'clockevents'

  /** GET /clockevents */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }
}
