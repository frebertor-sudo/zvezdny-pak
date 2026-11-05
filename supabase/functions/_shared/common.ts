// Общее для функций: CORS, ответы, клиент базы, проверка Twitch-токена.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export const CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID") ?? "";
export const CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET") ?? "";
export const CHANNEL = (Deno.env.get("TWITCH_CHANNEL") ?? "").toLowerCase();
export const EVENTSUB_SECRET = Deno.env.get("EVENTSUB_SECRET") ?? "";
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// Разрешённые адреса сайта (через запятую). По умолчанию — GitHub Pages и локальная разработка.
const ORIGINS = (Deno.env.get("SITE_ORIGINS") ?? "https://frebertor-sudo.github.io,http://localhost:8080")
  .split(",").map((s) => s.trim()).filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-twitch-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

let _db: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!_db) {
    _db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _db;
}

export type TwitchUser = { id: string; login: string; name: string; avatar: string; scopes: string[]; token: string };

// Проверяем токен у самого Twitch: кто это и выдан ли токен нашему приложению.
export async function twitchUser(req: Request): Promise<TwitchUser> {
  const token = (req.headers.get("x-twitch-token") ?? "").trim();
  if (!token) throw new HttpError(401, "no_token");
  const v = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
  if (!v.ok) throw new HttpError(401, "bad_token");
  const info = await v.json();
  if (info.client_id !== CLIENT_ID || !info.user_id) throw new HttpError(401, "foreign_token");
  let name = info.login, avatar = "";
  try {
    const u = await fetch("https://api.twitch.tv/helix/users", {
      headers: { Authorization: `Bearer ${token}`, "Client-Id": CLIENT_ID },
    });
    if (u.ok) {
      const d = (await u.json()).data?.[0];
      if (d) { name = d.display_name; avatar = d.profile_image_url; }
    }
  } catch (_) { /* профиль не обязателен */ }
  return { id: String(info.user_id), login: String(info.login).toLowerCase(), name, avatar, scopes: info.scopes ?? [], token };
}

export async function appToken(): Promise<string> {
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "client_credentials" }),
  });
  if (!r.ok) throw new HttpError(502, "app_token_failed");
  return (await r.json()).access_token;
}
