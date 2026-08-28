declare module "mssql" {
  export class ConnectionPool {
    request(): Request;
    close(): Promise<void>;
  }
  export class Request {
    input(
      name: string,
      type: unknown,
      value: unknown
    ): Request;
    query(text: string): Promise<{ recordset: Record<string, unknown>[] }>;
  }
  export const Int: unique symbol;
  export const Date: unique symbol;
  export function connect(config: {
    server: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    connectionTimeout?: number;
    requestTimeout?: number;
    options?: { encrypt?: boolean; trustServerCertificate?: boolean };
  }): Promise<ConnectionPool>;
  const sql: {
    connect: typeof connect;
    ConnectionPool: typeof ConnectionPool;
    Int: typeof Int;
    Date: typeof Date;
  };
  export default sql;
}
