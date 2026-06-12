import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental PayPlans API */
export class PayPlansService extends BaseDomainService {
  protected readonly resourcePath = 'payplans'

  /** GET /payplans */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** POST /payplans */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** POST /dynamic */
  async createDynamic(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('dynamic', body)
  }

  /** PUT /{id}/dynamic */
  async updateDynamic(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
