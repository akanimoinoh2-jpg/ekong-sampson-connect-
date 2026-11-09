(async () => {
  const base = "http://localhost:3000";
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ username: "senator", password: "EkongSampson2026!" })
  });
  const cookie = res.headers.get("set-cookie") || "";
  console.log("login:", res.status, await res.text(), "cookie?", !!cookie);
  const j = (r) => r.text().then((t) => [r.status, t]);
  const issues = await fetch(`${base}/api/admin/issues`, { headers: { cookie: cookie.split(";")[0] } }).then(j);
  console.log("issues:", issues[0], issues[1].slice(0, 400));
})().catch((e) => console.error("FAIL", e));
