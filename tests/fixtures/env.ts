export function env(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return value.trim();
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
