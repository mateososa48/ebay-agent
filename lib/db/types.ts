/** Minimal pg-compatible database seam. Both the Neon pool and PGlite satisfy it. */
export interface Db {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
