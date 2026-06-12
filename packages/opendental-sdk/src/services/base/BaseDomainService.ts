import type { OpenDentalClient } from '../../client/OpenDentalClient'
import type { ApiResponse, PaginationParams, RequestOptions } from '../../models/common'
import type { PracticeContext } from '../../practice/types'

export abstract class BaseDomainService {
  protected readonly client: OpenDentalClient
  protected readonly context: PracticeContext
  protected abstract readonly resourcePath: string

  constructor(client: OpenDentalClient, context: PracticeContext) {
    this.client = client
    this.context = context
  }

  getPracticeId(): string {
    return this.context.practiceId
  }

  protected buildPath(suffix = ''): string {
    const base = this.resourcePath.replace(/^\//, '')
    if (!suffix) return base
    const cleanSuffix = suffix.startsWith('/') ? suffix.slice(1) : suffix
    return `${base}/${cleanSuffix}`
  }

  protected async getList<T>(params?: Record<string, string | number | boolean | undefined | null>): Promise<T[]> {
    const result = await this.client.get<T[] | T>(this.buildPath(), { params })
    return Array.isArray(result) ? result : result ? [result] : []
  }

  protected async getSingle<T>(id: string | number, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.client.get<T>(this.buildPath(String(id)), { params })
  }

  protected async getSubResource<T>(
    subPath: string,
    params?: Record<string, string | number | boolean | undefined | null>
  ): Promise<T> {
    return this.client.get<T>(this.buildPath(subPath), { params })
  }

  protected async createRecord<T>(body: unknown, subPath = ''): Promise<ApiResponse<T>> {
    return this.client.post<T>(this.buildPath(subPath), { body })
  }

  protected async updateRecord<T = void>(id: string | number, body: unknown): Promise<T> {
    return this.client.put<T>(this.buildPath(String(id)), { body })
  }

  protected async updateSubResource<T = void>(subPath: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.client.put<T>(this.buildPath(subPath), { body, params })
  }

  protected async removeRecord(id: string | number): Promise<void> {
    await this.client.delete(this.buildPath(String(id)))
  }

  protected async removeSubResource(subPath: string): Promise<void> {
    await this.client.delete(this.buildPath(subPath))
  }

  protected async postAction<T>(subPath: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.client.post<T>(this.buildPath(subPath), { body, ...options })
  }

  async listPaginated<T>(params?: PaginationParams & Record<string, string | number | boolean | undefined>): Promise<T[]> {
    return this.getList<T>(params)
  }
}
