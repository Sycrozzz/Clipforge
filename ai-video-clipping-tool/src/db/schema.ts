import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  bigint,
} from "drizzle-orm/pg-core";
import type { AnalysisPrefs } from "@/lib/types";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sourcePath: text("source_path").notNull(),
  sourceName: text("source_name").notNull(),
  ownsSource: boolean("owns_source").notNull().default(true),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
  durationSec: doublePrecision("duration_sec").notNull().default(0),
  width: integer("width").notNull().default(0),
  height: integer("height").notNull().default(0),
  status: text("status").notNull().default("uploading"),
  stage: text("stage").notNull().default(""),
  progress: integer("progress").notNull().default(0),
  error: text("error"),
  analysisPrefs: jsonb("analysis_prefs").$type<AnalysisPrefs>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const clips = pgTable("clips", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  startSec: doublePrecision("start_sec").notNull(),
  endSec: doublePrecision("end_sec").notNull(),
  title: text("title").notNull().default(""),
  hook: text("hook").notNull().default(""),
  reason: text("reason").notNull().default(""),
  score: integer("score").notNull().default(0),
  emotions: jsonb("emotions").$type<string[]>().notNull().default([]),
  category: text("category").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const renders = pgTable("renders", {
  id: uuid("id").primaryKey().defaultRandom(),
  clipId: uuid("clip_id").notNull(),
  projectId: uuid("project_id").notNull(),
  kind: text("kind").notNull(), // raw | edited | preview
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  outputFile: text("output_file"),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  startSec: doublePrecision("start_sec").notNull().default(0),
  endSec: doublePrecision("end_sec").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
