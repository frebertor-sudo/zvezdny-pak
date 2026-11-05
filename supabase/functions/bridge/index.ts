// Мост чата: overlay.html (в OBS у стримера) анонимно читает чат Twitch и пересылает сюда
// коды входа и покупки награды «Звёздный пак». Принимаем только с ключом стримера.
import { adminKeyOk, channelName, corsHeaders, db, HttpError, json, randomToken, sha256 } from "../_shared/common.ts";

type Ev = { kind: "msg" | "reward"; user_id: string; login: string; name?: string; text?: string; msg_id: string; reward_id?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    if (req.method !== "POST") throw new HttpError(405, "POST only");
    if (!(await adminKeyOk(req, "x-bridge-key"))) throw new HttpError(403, "Неверный ключ стримера");
    const CHANNEL = await channelName();
    const body = await req.json().catch(() => ({}));
    const events: Ev[] = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
    const sb = db();
    const now = new Date().toISOString();
    const { data: s } = await sb.from("settings").select("reward_id").eq("id", 1).single();
    await sb.from("settings").update({ bridge_seen_at: now }).eq("id", 1);
    let rewardId: string | null = s?.reward_id ?? null;
    const out = { logins: 0, packs: 0, bound: false, reward_id: rewardId };

    for (const e of events) {
      const uid = String(e.user_id ?? ""), login = String(e.login ?? "").toLowerCase(), name = String(e.name ?? login).slice(0, 40);
      if (!uid || !/^[a-z0-9_]{1,25}$/.test(login) || !e.msg_id) continue;

      if (e.kind === "reward" && e.reward_id) {
        // привязка: стример сам покупает свою награду с текстом «привязать»
        if (!rewardId && login === CHANNEL && /привязать|bind/i.test(e.text ?? "")) {
          await sb.from("settings").update({ reward_id: e.reward_id }).eq("id", 1);
          rewardId = e.reward_id; out.bound = true; out.reward_id = rewardId;
          continue;
        }
        if (e.reward_id !== rewardId) continue;
        const { error } = await sb.from("redemptions").insert({ id: "irc:" + e.msg_id, twitch_id: uid });
        if (error) continue; // уже засчитано
        const r = await sb.rpc("add_packs", { p_uid: uid, p_login: login, p_name: name, p_n: 1 });
        if (r.error) await sb.from("redemptions").delete().eq("id", "irc:" + e.msg_id);
        else out.packs++;
        continue;
      }

      // код входа: зритель пишет в чат «!пак 1234»
      const m = /(\d{4})/.exec(e.text ?? "");
      if (!m) continue;
      const { data: l } = await sb.from("logins").select("id")
        .eq("login", login).eq("code", m[1]).is("verified_at", null).gt("expires_at", now)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!l) continue;
      await sb.rpc("add_packs", { p_uid: uid, p_login: login, p_name: name, p_n: 0 }); // создаём или обновляем профиль
      const token = randomToken();
      await sb.from("sessions").insert({ token_hash: await sha256(token), twitch_id: uid, login });
      await sb.from("logins").update({ verified_at: now, twitch_id: uid, token }).eq("id", l.id);
      out.logins++;
    }
    return json(req, out);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error(e);
    return json(req, { error: e instanceof HttpError ? e.message : "Ошибка сервера" }, status);
  }
});
