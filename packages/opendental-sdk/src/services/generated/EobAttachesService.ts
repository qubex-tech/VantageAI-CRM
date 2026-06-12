import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental EobAttaches API */
export class EobAttachesService extends BaseDomainService {
  protected readonly resourcePath = 'eobattaches'

  /** GET /eobattaches */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** POST /eobattaches */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** DELETE /{id} */
  async delete(id: string | number): Promise<unknown> {
    return this.removeRecord(id)
  }

  /** POST /downloadsftp */
  async downloadSftp(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('downloadsftp', body)
  }

  /** POST /uploadsftp */
  async uploadSftp(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('uploadsftp', body)
  }
}
