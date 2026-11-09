(async () => {
  const base = "http://localhost:3000";
  // 1. submit a real issue like the form would
  const sub = await fetch(`${base}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ name: "Admin Test", lga: "mkpat-enin", community: "Ikot Unya", category: "education", message: "Needs a new classroom block roof.", consent: "true" })
  });
  console.log("submit:", sub.status, await sub.text());
  // 2. login and read it back
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ username: "senator", password: "EkongSampson2026!" })
  });
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  const issues = await fetch(`${base}/api/admin/issues`, { headers: { cookie } }).then((r) => r.json());
  const match = issues.issues.find((i) => i.message.includes("classroom block roof"));
  console.log("visible in admin:", JSON.stringify(match));
})().catch((e) => console.error("FAIL", e));
