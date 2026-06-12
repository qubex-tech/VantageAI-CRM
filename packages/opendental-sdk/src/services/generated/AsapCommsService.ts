import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental AsapComms API */
export class AsapCommsService extends BaseDomainService {
  protected readonly resourcePath = 'asapcomms'

  /** GET /asapcomms */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** POST /asapcomms */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }
}
