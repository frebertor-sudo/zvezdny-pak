// Twitch EventSub: зритель купил награду «Звёздный пак» за баллы канала → +1 пакетик на сайте.
import { db, EVENTSUB_SECRET } from "../_shared/common.ts";

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const body = await req.text();
  const id = req.headers.get("Twitch-Eventsub-Message-Id") ?? "";
  const ts = req.headers.get("Twitch-Eventsub-Message-Timestamp") ?? "";
  const sig = req.headers.get("Twitch-Eventsub-Message-Signature") ?? "";
  const type = req.headers.get("Twitch-Eventsub-Message-Type") ?? "";
  if (!id || !ts || !sig || !EVENTSUB_SECRET) return new Response("bad request", { status: 400 });

  // подпись: HMAC-SHA256(secret, id + timestamp + тело)
  const key = await crypto.subtle.importKey("raw", enc.encode(EVENTSUB_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = "sha256=" + hex(await crypto.subtle.sign("HMAC", key, enc.encode(id + ts + body)));
  if (!safeEqual(mac, sig)) return new Response("bad signature", { status: 403 });
  if (Math.abs(Date.now() - Date.parse(ts)) > 10 * 60 * 1000) return new Response("stale", { status: 403 });

  const msg = JSON.parse(body);
  if (type === "webhook_callback_verification") {
    return new Response(msg.challenge, { headers: { "Content-Type": "text/plain" } });
  }
  if (type === "revocation") {
    console.warn("EventSub отозван:", msg.subscription?.status);
    return new Response(null, { status: 204 });
  }
  if (type === "notification" && msg.subscription?.type === "channel.channel_points_custom_reward_redemption.add") {
    const ev = msg.event;
    const sb = db();
    const { data: s } = await sb.from("settings").select("reward_id,broadcaster_id").eq("id", 1).single();
    if (s?.reward_id && ev.reward?.id !== s.reward_id) return new Response(null, { status: 204 });
    if (s?.broadcaster_id && ev.broadcaster_user_id !== s.broadcaster_id) return new Response(null, { status: 204 });
    // повтор той же покупки не начисляем дважды
    const { error } = await sb.from("redemptions").insert({ id: ev.id, twitch_id: ev.user_id });
    if (!error) {
      const r = await sb.rpc("add_packs", { p_uid: ev.user_id, p_login: ev.user_login, p_name: ev.user_name, p_n: 1 });
      if (r.error) {
        await sb.from("redemptions").delete().eq("id", ev.id); // дадим Twitch повторить доставку
        return new Response("db error", { status: 500 });
      }
    }
  }
  return new Response(null, { status: 204 });
});
