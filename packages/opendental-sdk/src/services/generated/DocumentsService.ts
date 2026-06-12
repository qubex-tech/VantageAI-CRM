import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental Documents API */
export class DocumentsService extends BaseDomainService {
  protected readonly resourcePath = 'documents'

  /** GET /documents */
  async list(params?: Record<string, string | number | boolean | undefined | null>): Promise<unknown> {
    return this.getList<Record<string, unknown>>(params)
  }

  /** GET /{id} */
  async get(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.getSingle<Record<string, unknown>>(id, params)
  }

  /** POST /upload */
  async upload(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('upload', body)
  }

  /** POST /downloadsftp */
  async downloadSftp(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('downloadsftp', body)
  }

  /** POST /setbyurl */
  async setByUrl(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('setbyurl', body)
  }

  /** POST /uploadsftp */
  async uploadSftp(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('uploadsftp', body)
  }

  /** POST /thumbnails */
  async thumbnails(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('thumbnails', body)
  }

  /** POST /downloadmount */
  async downloadMount(body: Record<string, unknown>): Promise<unknown> {
    return this.postAction<Record<string, unknown>>('downloadmount', body)
  }

  /** PUT /{id} */
  async update(id: string | number, body: Record<string, unknown>): Promise<unknown> {
    return this.updateRecord(id, body)
  }

  /** DELETE /{id} */
  async delete(id: string | number): Promise<unknown> {
    return this.removeRecord(id)
  }
}
