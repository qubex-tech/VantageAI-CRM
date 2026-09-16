import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Patients API */
export class PatientsService extends BaseDomainService {
  protected readonly resourcePath = 'patients'

  /** GET /patients */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** GET /patients/Simple — DateTStamp and other filters only work on this endpoint. */
  async getSimple(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('Simple', params)
  }

  /** POST /patients */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
