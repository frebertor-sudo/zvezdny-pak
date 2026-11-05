// Единая точка API сайта. Каждый запрос подтверждается Twitch-токеном (заголовок x-twitch-token).
import {
  appToken, CHANNEL, CLIENT_ID, corsHeaders, db, EVENTSUB_SECRET, HttpError, json, SUPABASE_URL,
  twitchUser, type TwitchUser,
} from "../_shared/common.ts";

const RARITIES = ["common", "rare", "epic", "legendary"];
const ERR_TEXT: Record<string, string> = {
  no_packs: "Нет пакетиков: купи «Звёздный пак» за баллы канала на Twitch",
  no_cards: "В наборе пока нет карточек",
  not_enough_dust: "Не хватает пыльцы",
  already_owned: "Эта карточка уже есть в коллекции",
  no_card: "Такой карточки нет",
};

async function profileWithCollection(uid: string) {
  const sb = db();
  const [{ data: profile }, { data: owned }] = await Promise.all([
    sb.from("profiles").select("twitch_id,login,name,avatar,packs,dust,pulls,since,dupes").eq("twitch_id", uid).single(),
    sb.from("owned").select("card_id,foil,count,first_at").eq("twitch_id", uid),
  ]);
  return { profile, owned: owned ?? [] };
}

function rpcError(e: { message?: string } | null) {
  if (!e) return;
  const code = Object.keys(ERR_TEXT).find((k) => e.message?.includes(k));
  throw new HttpError(code ? 409 : 500, code ? ERR_TEXT[code] : "Ошибка базы");
}

function requireStreamer(u: TwitchUser) {
  if (!CHANNEL || u.login !== CHANNEL) throw new HttpError(403, "Только для стримера канала");
}

// картинка приходит как data:URL после обрезки в панели
async function uploadImage(id: string, dataUrl: string): Promise<string> {
  const m = /^data:(image\/(webp|jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, "Картинка должна быть webp, jpeg или png");
  const bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0));
  if (bytes.length > 1_500_000) throw new HttpError(413, "Картинка больше 1,5 МБ");
  const path = `${id}-${Date.now()}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
  const { error } = await db().storage.from("cards").upload(path, bytes, { contentType: m[1], upsert: true });
  if (error) throw new HttpError(500, "Не удалось сохранить картинку");
  return db().storage.from("cards").getPublicUrl(path).data.publicUrl;
}

async function helix(path: string, init: RequestInit & { token: string }) {
  const r = await fetch(`https://api.twitch.tv/helix/${path}`, {
    ...init,
    headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${init.token}`, "Content-Type": "application/json" },
  });
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body };
}

// Создаёт награду «Звёздный пак» на канале и подписку EventSub на её покупку.
async function setupReward(u: TwitchUser) {
  requireStreamer(u);
  if (!u.scopes.includes("channel:manage:redemptions")) {
    throw new HttpError(403, "Войди заново: нужен доступ к наградам канала");
  }
  const sb = db();
  const { data: s } = await sb.from("settings").select("*").eq("id", 1).single();
  const reward = {
    title: "Звёздный пак",
    cost: s.cost,
    prompt: "Пакетик с карточкой канала. Открой его на сайте и собери коллекцию!",
    is_enabled: true,
    background_color: "#9B7BFF",
    should_redemptions_skip_request_queue: true,
  };
  let rewardId: string | null = s.reward_id;
  if (rewardId) {
    const r = await helix(`channel_points/custom_rewards?broadcaster_id=${u.id}&id=${rewardId}`, {
      method: "PATCH", token: u.token, body: JSON.stringify(reward),
    });
    if (!r.ok) rewardId = null; // награду удалили на Twitch — создадим заново
  }
  if (!rewardId) {
    const r = await helix(`channel_points/custom_rewards?broadcaster_id=${u.id}`, {
      method: "POST", token: u.token, body: JSON.stringify(reward),
    });
    if (!r.ok) {
      const msg = r.body?.message ?? "";
      throw new HttpError(r.status, r.status === 403
        ? "Twitch не дал создать награду: баллы канала есть только у компаньонов и партнёров"
        : `Twitch: ${msg || "не удалось создать награду"}`);
    }
    rewardId = r.body.data[0].id;
  }

  // подписка приходит в функцию eventsub; её создаёт приложение (app token)
  const app = await appToken();
  const sub = await helix("eventsub/subscriptions", {
    method: "POST", token: app,
    body: JSON.stringify({
      type: "channel.channel_points_custom_reward_redemption.add",
      version: "1",
      condition: { broadcaster_user_id: u.id, reward_id: rewardId },
      transport: { method: "webhook", callback: `${SUPABASE_URL}/functions/v1/eventsub`, secret: EVENTSUB_SECRET },
    }),
  });
  if (!sub.ok && sub.status !== 409) throw new HttpError(502, `EventSub: ${sub.body?.message ?? "ошибка подписки"}`);

  await sb.from("settings").update({
    broadcaster_id: u.id, reward_id: rewardId,
    eventsub_id: sub.ok ? sub.body.data[0].id : s.eventsub_id, updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return { reward_id: rewardId, subscribed: true, status: sub.ok ? sub.body.data[0].status : "already_exists" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    if (req.method !== "POST") throw new HttpError(405, "POST only");
    const body = await req.json().catch(() => ({}));
    const u = await twitchUser(req);
    const sb = db();

    switch (body.action) {
      // ---------- зритель ----------
      case "me": {
        await sb.from("profiles").upsert(
          { twitch_id: u.id, login: u.login, name: u.name, avatar: u.avatar, updated_at: new Date().toISOString() },
          { onConflict: "twitch_id", ignoreDuplicates: false },
        );
        return json(req, { ...(await profileWithCollection(u.id)), is_streamer: u.login === CHANNEL, scopes: u.scopes });
      }
      case "open": {
        const { data, error } = await sb.rpc("open_pack", { p_uid: u.id });
        rpcError(error);
        return json(req, { result: data, ...(await profileWithCollection(u.id)) });
      }
      case "craft": {
        const { data, error } = await sb.rpc("craft_card", { p_uid: u.id, p_card: String(body.card_id), p_foil: !!body.foil });
        rpcError(error);
        return json(req, { result: data, ...(await profileWithCollection(u.id)) });
      }

      // ---------- стример ----------
      case "card_save": {
        requireStreamer(u);
        const name = String(body.name ?? "").trim().slice(0, 40);
        const flavor = String(body.flavor ?? "").trim().slice(0, 120);
        const rarity = String(body.rarity);
        if (!name || !RARITIES.includes(rarity)) throw new HttpError(400, "Нужны название и редкость");
        const id = body.id ? String(body.id) : "c" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
        const row: Record<string, unknown> = { id, name, flavor, rarity, tall: body.tall !== false };
        if (body.image) row.img = await uploadImage(id, String(body.image));
        if (!body.id) {
          if (!row.img) throw new HttpError(400, "Добавь картинку");
          const { data: last } = await sb.from("cards").select("sort").order("sort", { ascending: false }).limit(1);
          row.sort = (last?.[0]?.sort ?? 0) + 1;
          row.active = true;
        }
        const { error } = await sb.from("cards").upsert(row);
        if (error) throw new HttpError(500, "Не удалось сохранить карточку");
        return json(req, { ok: true, id });
      }
      case "card_delete": {
        requireStreamer(u);
        await sb.from("cards").update({ active: false }).eq("id", String(body.id));
        return json(req, { ok: true });
      }
      case "card_order": {
        requireStreamer(u);
        const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
        await Promise.all(ids.map((id, i) => sb.from("cards").update({ sort: i + 1 }).eq("id", id)));
        return json(req, { ok: true });
      }
      case "settings_save": {
        requireStreamer(u);
        const odds: Record<string, number> = {};
        for (const r of RARITIES) odds[r] = Math.max(0, Math.min(1000, Number(body.odds?.[r]) || 0));
        if (!Object.values(odds).some((v) => v > 0)) throw new HttpError(400, "Хотя бы одна редкость должна выпадать");
        const patch = {
          odds,
          foil: Math.max(0, Math.min(100, Number(body.foil) || 0)),
          pity: Math.max(2, Math.min(100, Math.round(Number(body.pity) || 10))),
          cost: Math.max(1, Math.round(Number(body.cost) || 5000)),
          updated_at: new Date().toISOString(),
        };
        await sb.from("settings").update(patch).eq("id", 1);
        return json(req, { ok: true });
      }
      case "grant": { // выдать пакетики зрителю вручную (розыгрыши, тесты)
        requireStreamer(u);
        const login = String(body.login ?? "").toLowerCase().replace(/^@/, "");
        const n = Math.max(1, Math.min(100, Math.round(Number(body.n) || 1)));
        const { data: p } = await sb.from("profiles").select("twitch_id,login,name").eq("login", login).maybeSingle();
        if (!p) throw new HttpError(404, "Этот зритель ещё ни разу не заходил на сайт");
        const { data: left, error } = await sb.rpc("add_packs", { p_uid: p.twitch_id, p_login: p.login, p_name: p.name, p_n: n });
        rpcError(error);
        return json(req, { ok: true, packs: left });
      }
      case "reward_setup":
        return json(req, await setupReward(u));

      default:
        throw new HttpError(400, "unknown_action");
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error(e);
    return json(req, { error: e instanceof HttpError ? e.message : "Ошибка сервера" }, status);
  }
});
