import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __darsiFrontendPgPool: Pool | undefined;
}

function createPool() {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.HOSPITAL_CS_DATABASE_URL ??
    "postgresql://postgres:PASSWORD@localhost:5432/hospital_cs";

  return new Pool({ connectionString });
}

export function getDbPool() {
  if (!globalThis.__darsiFrontendPgPool) {
    globalThis.__darsiFrontendPgPool = createPool();
  }
  return globalThis.__darsiFrontendPgPool;
}

export function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getDbPool().query<T>(text, params);
}
