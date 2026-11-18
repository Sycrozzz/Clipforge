import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULT_EDIT_PREFS, normalizeEditPrefs, type EditPrefs } from "./types";

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  transcribeModel: string;
  chatModel: string;
}

export const AI_DEFAULTS: Omit<AiConfig, "apiKey"> = {
  baseUrl: "https://api.openai.com/v1",
  transcribeModel: "whisper-1",
  chatModel: "gpt-4o-mini",
};

export async function getAiConfig(): Promise<AiConfig> {
  const [apiKey, baseUrl, transcribeModel, chatModel] = await Promise.all([
    getSetting("apiKey"),
    getSetting("baseUrl"),
    getSetting("transcribeModel"),
    getSetting("chatModel"),
  ]);
  return {
    apiKey: apiKey || process.env.OPENAI_API_KEY || "",
    baseUrl: (baseUrl || process.env.OPENAI_BASE_URL || AI_DEFAULTS.baseUrl).replace(/\/+$/, ""),
    transcribeModel: transcribeModel || AI_DEFAULTS.transcribeModel,
    chatModel: chatModel || AI_DEFAULTS.chatModel,
  };
}

export async function getSavedEditPrefs(): Promise<EditPrefs> {
  const raw = await getSetting("editPrefs");
  if (!raw) return structuredClone(DEFAULT_EDIT_PREFS);
  try {
    return normalizeEditPrefs(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_EDIT_PREFS);
  }
}
