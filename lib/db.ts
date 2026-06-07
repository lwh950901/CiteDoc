import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

/**
 * Drizzle ORM 数据库实例
 * 使用 node-postgres (pg) 连接池，支持本地 Docker pgvector 和生产环境
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : false,
  // Vercel 环境强制 IPv4 + 连接超时
  ...(process.env.VERCEL ? { family: 4, connectionTimeoutMillis: 10000 } : {}),
});

export const db = drizzle(pool, { schema });
