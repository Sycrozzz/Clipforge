import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * ClipForge talks to PostgreSQL when DATABASE_URL is set (development / hosted),
 * and falls back to an embedded PGlite database stored in the data folder when it
 * is not (packaged desktop build: nothing to install).
 */

export type Db = NodePgDatabase<typeof schema>;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_path text NOT NULL,
  source_name text NOT NULL,
  owns_source boolean NOT NULL DEFAULT true,
  size_bytes bigint NOT NULL DEFAULT 0,
  duration_sec double precision NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploading',
  stage text NOT NULL DEFAULT '',
  progress integer NOT NULL DEFAULT 0,
  error text,
  analysis_prefs jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  start_sec double precision NOT NULL,
  end_sec double precision NOT NULL,
  title text NOT NULL DEFAULT '',
  hook text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  score integer NOT NULL DEFAULT 0,
  emotions jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL,
  project_id uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  output_file text,
  settings jsonb,
  start_sec double precision NOT NULL DEFAULT 0,
  end_sec double precision NOT NULL DEFAULT 0,
  error text,
  created_at timestamp NOT NULL DEFAULT now()
);
UPDATE projects SET status = 'error', error = 'Processing was interrupted (the app was closed). Press Analyze to try again.' WHERE status = 'processing';
UPDATE renders SET status = 'error', error = 'Interrupted (the app was closed).' WHERE status IN ('queued', 'rendering');
`;

interface DbState {
  db: Db;
  ready: Promise<void>;
}

const g = globalThis as typeof globalThis & { __clipforgeDb?: DbState };

function init(): DbState {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url });
    const db = drizzlePg(pool, { schema });
    return { db, ready: pool.query(SCHEMA_SQL).then(() => undefined) };
  }
  const dataDir = process.env.CLIPFORGE_DATA_DIR || path.join(process.cwd(), "data");
  const dbDir = path.join(dataDir, "db");
  fs.mkdirSync(dbDir, { recursive: true });
  const client = new PGlite(dbDir);
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return { db, ready: client.exec(SCHEMA_SQL).then(() => undefined) };
}

export async function getDb(): Promise<Db> {
  if (!g.__clipforgeDb) g.__clipforgeDb = init();
  await g.__clipforgeDb.ready;
  return g.__clipforgeDb.db;
}
