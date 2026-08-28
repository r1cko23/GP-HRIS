declare module "mssql" {
  export class ConnectionPool {
    request(): Request;
    close(): Promise<void>;
  }
  export class Request {
    query(text: string): Promise<{ recordset: Record<string, unknown>[] }>;
  }
  export function connect(config: {
    server: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    options?: { encrypt?: boolean; trustServerCertificate?: boolean };
  }): Promise<ConnectionPool>;
  const sql: {
    connect: typeof connect;
    ConnectionPool: typeof ConnectionPool;
  };
  export default sql;
}
