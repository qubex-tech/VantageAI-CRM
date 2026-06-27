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

  /** GET /SlotsWebSched */
  async getSlotsWebSched(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('SlotsWebSched', params)
  }

  /** GET /Slots */
  async getSlots(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('Slots', params)
  }

  /** GET /ASAP */
  async getASAP(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('ASAP', params)
  }

  /** GET /WebSched */
  async getWebSched(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getSubResource<Record<string, unknown>>('WebSched', params)
  }

  /** POST /appointments */
  async create(body: Record<string, unknown>): Promise<unknown> {
    return this.createRecord<Record<string, unknown>>(body)
  }

  /** POST /Planned */
  async createPlanned(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('Planned', body)
  }

  /** POST /SchedulePlanned */
  async createSchedulePlanned(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('SchedulePlanned', body)
  }

  /** POST /WebSched */
  async createWebSched(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('WebSched', body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** PUT /{id}/Break */
  async break(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateSubResource(`${id}/Break`, body)
  }

  /** PUT /{id}/Confirm */
  async confirm(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateSubResource(`${id}/Confirm`, body)
  }

  /** PUT /{id}/Note */
  async updateNote(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateSubResource(`${id}/Note`, body)
  }
}
