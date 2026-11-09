(async () => {
  const base = "http://localhost:3000";
  const j = (r) => r.text().then((t) => [r.status, t]);
  // 1. admin page
  const admin = await fetch(`${base}/admin`).then(j);
  console.log("GET /admin ->", admin[0], admin[1].slice(0, 120));
  // 2. login
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ username: "admin", password: "secret1" })
  });
  const cookie = res.headers.get("set-cookie") || "";
  console.log("POST /api/auth/login ->", res.status, await res.text());
  // 3. issues with cookie
  const issues = await fetch(`${base}/api/admin/issues`, { headers: { cookie: cookie.split(";")[0] } }).then(j);
  console.log("GET /api/admin/issues ->", issues[0], issues[1].slice(0, 200));
  // 4. submit an issue
  const sub = await fetch(`${base}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ name: "Test User", lga: "eket", community: "Test Community", category: "health", message: "Test issue message", consent: "true" })
  }).then(j);
  console.log("POST /api/issues ->", sub[0], sub[1]);
  // 5. issues again
  const issues2 = await fetch(`${base}/api/admin/issues`, { headers: { cookie: cookie.split(";")[0] } }).then(j);
  console.log("GET /api/admin/issues after submit ->", issues2[0], issues2[1].slice(0, 300));
})().catch((e) => console.error("PROBE FAILED:", e));
