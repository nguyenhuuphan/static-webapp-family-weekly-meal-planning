export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MENU_WORKFLOW: Workflow<{ id: string }>;
  FAMILY_ACCESS_CODE?: string;
  GEMINI_API_KEY?: string;
  AI_MAX_DAILY_REQUESTS?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  DEV_ALLOW_AUTH_BYPASS?: string;
}
export type WriteOptions = { onlyIfNew?: boolean; onlyIfMatch?: string };
export type Stored<T = unknown> = { data: T; etag: string };
