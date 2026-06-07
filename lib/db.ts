import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

/**
 * Drizzle ORM 数据库实例
 * 使用 node-postgres (pg) 连接池，支持本地 Docker pgvector 和生产环境
 */
const databaseUrl = process.env.DATABASE_URL!;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes("supabase") ? { rejectUnauthorized: false } : false,
  // Vercel serverless：IPv4 + 短超时 + 单连接，避免耗尽 pooler 配额
  ...(process.env.VERCEL
    ? { family: 4, connectionTimeoutMillis: 10000, max: 1 }
    : {}),
});

export const db = drizzle(pool, { schema });
