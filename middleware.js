// ===== Server-side password gate (Vercel Edge Middleware) =====
// Runs on Vercel's edge BEFORE any file is served — including every image in
// /images and /thumbs. Unauthenticated visitors cannot fetch the photos at all,
// no matter how they craft the URL. The password lives only in the SITE_PASSWORD
// env var on the server; it is never sent to the browser or stored in the repo.

export const config = {
  // Run on everything except the login API and Vercel's internals.
  matcher: "/((?!api|_vercel|_next).*)",
};

// Files the login screen itself needs, allowed through even when locked out.
const PUBLIC = new Set([
  "/styles.css",
  "/IAM_Microschool-300x300.jpg",
  "/favicon.ico",
]);

// Recreate the session token from the secret. Same logic as api/login.js.
async function makeToken(secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("iam-gate-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time-ish compare so a valid cookie can't be guessed byte by byte.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function middleware(req) {
  const { pathname } = new URL(req.url);

  const cookies = req.headers.get("cookie") || "";
  const match = cookies.match(/(?:^|;\s*)iam_auth=([a-f0-9]+)/);
  const expected = await makeToken(process.env.SESSION_SECRET || "");
  const authed = !!match && safeEqual(match[1], expected);

  // Logged in → serve the requested file normally.
  if (authed) return;

  // Assets the login page needs are always allowed.
  if (PUBLIC.has(pathname)) return;

  // A page navigation gets the styled login screen…
  const accept = req.headers.get("accept") || "";
  if (req.method === "GET" && accept.includes("text/html")) {
    return new Response(GATE_HTML, {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // …everything else (images, thumbs, app.js, json) is blocked outright.
  return new Response("Unauthorized", {
    status: 401,
    headers: { "cache-control": "no-store" },
  });
}

const GATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IAM Microschool · Enter Password</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="icon" type="image/jpeg" href="/IAM_Microschool-300x300.jpg" />
</head>
<body>
  <div class="gate" id="gate">
    <form class="gate__card" id="gf">
      <img class="gate__logo" src="/IAM_Microschool-300x300.jpg" alt="IAM Microschool logo" />
      <h1 class="gate__title">IAM Microschool 2025-2026</h1>
      <input class="gate__input" id="gi" type="password" placeholder="Password"
             autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <button class="gate__btn" type="submit">Enter</button>
      <p class="gate__error" id="ge" role="alert"></p>
    </form>
  </div>
  <script>
    (function () {
      var f = document.getElementById("gf");
      var i = document.getElementById("gi");
      var e = document.getElementById("ge");
      function fail() {
        e.textContent = "Incorrect password. Please try again.";
        i.value = ""; i.focus();
        f.classList.remove("gate__card--shake");
        void f.offsetWidth;
        f.classList.add("gate__card--shake");
      }
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        e.textContent = "";
        fetch("/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: i.value }),
        }).then(function (r) {
          if (r.ok) { window.location.reload(); } else { fail(); }
        }).catch(fail);
      });
      i.focus();
    })();
  </script>
</body>
</html>`;
