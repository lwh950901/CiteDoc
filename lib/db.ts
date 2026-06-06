import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

/**
 * Drizzle ORM 数据库实例
 * 使用 node-postgres (pg) 连接池，支持本地 Docker pgvector 和生产环境
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, { schema });
