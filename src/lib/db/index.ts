/**
 * Database connection singleton for Drizzle ORM + mysql2.
 */
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let db: MySql2Database<typeof schema> | null = null;
let pool: mysql.Pool | null = null;

export function getDb() {
    if (!db) {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error("DATABASE_URL environment variable is not set");
        }
        pool = mysql.createPool({
            uri: url,
            waitForConnections: true,
            connectionLimit: 10,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db = drizzle(pool as any, { schema, mode: "default" });
    }
    return db!;
}

export function getPool() {
    if (!pool) {
        getDb();
    }

    return pool!;
}

export async function closeDb() {
    if (pool) {
        await pool.end();
        pool = null;
        db = null;
    }
}

export { schema };
