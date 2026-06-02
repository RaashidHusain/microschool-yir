// ===== Login endpoint (Vercel Edge Function) =====
// Verifies the submitted password against the SITE_PASSWORD env var and, on
// success, sets a signed HttpOnly cookie that middleware.js checks on every
// request. The password is compared on the server and never reaches the client.

export const config = { runtime: "edge" };

async function makeToken(secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("iam-gate-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = (body && body.password) || "";
  } catch (_) {}

  const expected = process.env.SITE_PASSWORD || "";
  if (!expected || password !== expected) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const token = await makeToken(process.env.SESSION_SECRET || "");
  const cookie = [
    "iam_auth=" + token,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=" + 60 * 60 * 24 * 30, // 30 days
  ].join("; ");

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "set-cookie": cookie,
    },
  });
}
