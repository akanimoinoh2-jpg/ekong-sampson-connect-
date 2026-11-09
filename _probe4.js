(async () => {
  const base = "https://ekong-sampson-connect-2.onrender.com";
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ username: "probe", password: "probe" })
  });
  console.log("prod login ->", res.status, await res.text());
  const admin = await fetch(`${base}/admin`);
  console.log("prod /admin ->", admin.status);
})().catch((e) => console.error("FAIL", e));
