const s = require("fs").readFileSync("server.js", "utf8");
const idx = s.indexOf('app.post("/api/auth/login"');
console.log(s.slice(idx - 400, idx + 1500));
