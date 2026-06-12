import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Appointments API */
export class AppointmentsService extends BaseDomainService {
  protected readonly resourcePath = 'appointments'

  /** GET /appointments */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** GET /slotswebsched */
  async getSlotsWebSched(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('slotswebsched', params)
  }

  /** GET /slots */
  async getSlots(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('slots', params)
  }

  /** GET /asap */
  async getASAP(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('asap', params)
  }

  /** GET /websched */
  async getWebSched(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('websched', params)
  }

  /** POST /appointments */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** POST /planned */
  async createPlanned(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('planned', body)
  }

  /** POST /scheduleplanned */
  async createSchedulePlanned(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('scheduleplanned', body)
  }

  /** POST /websched */
  async createWebSched(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('websched', body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** PUT /{id}/break */
  async break(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** PUT /{id}/confirm */
  async confirm(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** PUT /{id}/note */
  async updateNote(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }
}
