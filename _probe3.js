const fs = require("fs");
const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
for (const l of lines) {
  if (!l.trim()) continue;
  const eq = l.indexOf("=");
  const k = l.slice(0, eq).trim();
  const v = l.slice(eq + 1).trim();
  console.log(k, "value length:", v.length, "quoted:", v.startsWith('"') || v.startsWith("'"));
}
