import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Queries API */
export class QueriesService extends BaseDomainService {
  protected readonly resourcePath = 'queries'

  /** POST /queries */
  async post(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** PUT /shortquery */
  async shortQuery(body: Record<string, unknown>): Promise<unknown> {
    return this.updateSubResource<Record<string, unknown>>('shortquery', body)
  }
}
