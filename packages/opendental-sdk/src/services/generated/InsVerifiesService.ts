import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental InsVerifies API */
export class InsVerifiesService extends BaseDomainService {
  protected readonly resourcePath = 'insverifies'

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
