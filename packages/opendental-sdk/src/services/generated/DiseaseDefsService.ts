import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental DiseaseDefs API */
export class DiseaseDefsService extends BaseDomainService {
  protected readonly resourcePath = 'diseasedefs'

  /** GET /diseasedefs */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** POST /diseasedefs */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }
}
