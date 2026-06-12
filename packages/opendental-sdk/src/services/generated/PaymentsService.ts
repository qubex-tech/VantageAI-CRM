import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Payments API */
export class PaymentsService extends BaseDomainService {
  protected readonly resourcePath = 'payments'

  /** GET /payments */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /payments */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** POST /refund */
  async createRefund(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('refund', body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** PUT /{id}/partial */
  async updatePartial(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
