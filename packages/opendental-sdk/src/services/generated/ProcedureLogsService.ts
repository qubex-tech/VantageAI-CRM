import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ProcedureLogs API */
export class ProcedureLogsService extends BaseDomainService {
  protected readonly resourcePath = 'procedurelogs'

  /** GET /procedurelogs */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /insurancehistory */
  async getInsuranceHistory(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('insurancehistory', params)
  }

  /** POST /procedurelogs */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** POST /insurancehistory */
  async createInsuranceHistory(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('insurancehistory', body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** DELETE /{id} */
  async delete(id: string | number): Promise<unknown> {
    return this.removeRecord(id)
  }

  /** POST /groupnote */
  async createGroupNote(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('groupnote', body)
  }

  /** PUT /groupnote */
  async updateGroupNote(body: Record<string, unknown>): Promise<unknown> {
    return this.updateSubResource<Record<string, unknown>>('groupnote', body)
  }

  /** DELETE /groupnote */
  async deleteGroupNote(): Promise<unknown> {
    return this.removeSubResource('groupnote')
  }
}
