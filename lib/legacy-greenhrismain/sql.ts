/**
 * Read-only SQL Server access to GREENHRISMAIN (catalog / diagnostic).
 * Never INSERT/EXEC from GP runtime — ADR 0003, 0009.
 */

import sql from "mssql";

export function legacySqlConfigured(): boolean {
  return Boolean(
    process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_PASSWORD
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function withLegacyPool<T>(
  fn: (pool: sql.ConnectionPool) => Promise<T>
): Promise<T> {
  if (!legacySqlConfigured()) {
    throw new Error("GREENHRISMAIN SQL is not configured (SQL_HOST / SQL_USER / SQL_PASSWORD)");
  }
  const pool = await sql.connect({
    server: required("SQL_HOST"),
    user: required("SQL_USER"),
    password: required("SQL_PASSWORD"),
    database: process.env.SQL_DATABASE || "GREENHRISMAIN",
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 120000,
  });
  try {
    return await fn(pool);
  } finally {
    await pool.close();
  }
}
