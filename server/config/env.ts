export interface AppEnv {
  port: number;
  databaseUrl: string | null;
  nodeEnv: "development" | "test" | "production";
  corsOrigins: string[];
  adminToken: string | null;
}

function readPort() {
  const rawPort = process.env.PORT ?? "4177";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }
  return port;
}

function readDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).toString();
  } catch {
    throw new Error("Invalid DATABASE_URL value.");
  }
}

function readNodeEnv() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error(`Invalid NODE_ENV value: ${nodeEnv}`);
  }
  return nodeEnv;
}

function readCorsOrigins() {
  const rawOrigins = process.env.CORS_ORIGIN?.trim();
  if (!rawOrigins) return [];
  return rawOrigins.split(",").map((item) => item.trim()).filter(Boolean);
}

export function readEnv(): AppEnv {
  const databaseUrl = readDatabaseUrl();
  const nodeEnv = readNodeEnv();
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
  }
  process.env.NODE_ENV = nodeEnv;

  return {
    port: readPort(),
    databaseUrl,
    nodeEnv,
    corsOrigins: readCorsOrigins(),
    adminToken: process.env.ADMIN_TOKEN?.trim() || null
  };
}
