import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

function sql() {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

export async function getState(key: string) {
  const [row] = await sql()`SELECT value FROM state WHERE key = ${key}`;
  return row ? (row.value as Record<string, unknown>) : null;
}

export async function setState(key: string, value: unknown) {
  await sql()`
    INSERT INTO state (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export async function deleteState(key: string) {
  await sql()`DELETE FROM state WHERE key = ${key}`;
}
