"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const express = require("express");
const multer = require("multer");

const app = express();
const port = Number(process.env.PORT || 3000);
const siteDirectory = path.join(__dirname, "designs", "ekong-sampson-connect");
const dataDirectory = path.resolve(process.env.PROJECT_DATA_DIR || path.join(__dirname, "data"));
const uploadsDirectory = path.join(dataDirectory, "uploads");
const issueAttachmentsDirectory = path.join(dataDirectory, "issue-attachments");
const databasePath = path.resolve(process.env.PROJECT_DB_PATH || path.join(dataDirectory, "projects.sqlite"));
const staffUsername = process.env.STAFF_USERNAME || "";
const staffPassword = process.env.STAFF_PASSWORD || "";
const staffEnabled = staffUsername.length > 0 && staffPassword.length >= 6;
const sessionDurationMs = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const issueSubmissionAttempts = new Map();
const cookieName = "ekong_staff_session";
const allowedLgas = new Set([
  "eket", "esit-eket", "ibeno", "onna", "mkpat-enin", "ikot-abasi",
  "eastern-obolo", "oron", "mbo", "okobo", "udung-uko", "urue-offong-oruko"
]);
const allowedSectors = new Set(["education", "health", "infrastructure", "water", "agriculture", "other"]);
const allowedStatuses = new Set(["proposal", "ongoing", "completed"]);
const allowedIssueCategories = new Set(["infrastructure", "education", "health", "security", "other"]);
const imageTypes = new Map([
  ["image/jpeg", { extension: ".jpg", signature: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ["image/png", { extension: ".png", signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ["image/webp", { extension: ".webp", signature: (buffer) => buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" }]
]);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.mkdirSync(uploadsDirectory, { recursive: true });
fs.mkdirSync(issueAttachmentsDirectory, { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    lga TEXT NOT NULL,
    community TEXT NOT NULL,
    sector TEXT NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL,
    description TEXT NOT NULL,
    funding TEXT NOT NULL,
    evidence TEXT NOT NULL,
    image_path TEXT,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS community_issues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lga TEXT NOT NULL,
    community TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    attachment_path TEXT,
    attachment_name TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  );
`);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  });
  next();
});
app.use(express.json({ limit: "20kb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!imageTypes.has(file.mimetype)) {
      callback(new Error("Project image must be a JPEG, PNG or WebP file."));
      return;
    }
    callback(null, true);
  }
});
const issueUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new Error("Issue attachment must be a PDF, JPEG, PNG or WebP file."));
      return;
    }
    callback(null, true);
  }
});

function safeEqual(actual, expected) {
  const actualHash = crypto.createHash("sha256").update(actual).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function requireSameOrigin(req, res, next) {
  const expectedOrigin = `${req.protocol}://${req.get("host")}`;
  if (req.get("origin") !== expectedOrigin) {
    res.status(403).json({ error: "Request origin could not be verified." });
    return;
  }
  next();
}

function getSessionToken(req) {
  const cookies = (req.get("cookie") || "").split(";").map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`));
  return sessionCookie ? sessionCookie.slice(cookieName.length + 1) : "";
}

function requireStaff(req, res, next) {
  const token = getSessionToken(req);
  console.log('requireStaff: token=', token, 'cookie=', req.get('cookie'));
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    res.status(401).json({ error: "Staff sign-in is required." });
    return;
  }
  req.staffUsername = session.username;
  next();
}

function formatProject(row) {
  return {
    id: row.id,
    title: row.title,
    lga: row.lga,
    community: row.community,
    sector: row.sector,
    year: row.year,
    status: row.status,
    description: row.description,
    funding: row.funding,
    evidence: row.evidence,
    imageUrl: row.image_path ? `/uploads/${encodeURIComponent(path.basename(row.image_path))}` : "",
    published: Boolean(row.published),
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

function readTextField(body, key, label, maxLength, required = true) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  if (required && !value) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return value;
}

function issueAttachmentType(file) {
  const buffer = file.buffer;
  if (file.mimetype === "application/pdf" && buffer.toString("ascii", 0, 5) === "%PDF-") return ".pdf";
  if (file.mimetype === "image/jpeg" && imageTypes.get("image/jpeg").signature(buffer)) return ".jpg";
  if (file.mimetype === "image/png" && imageTypes.get("image/png").signature(buffer)) return ".png";
  if (file.mimetype === "image/webp" && imageTypes.get("image/webp").signature(buffer)) return ".webp";
  return "";
}

function formatIssue(row) {
  return {
    id: row.id,
    name: row.name,
    lga: row.lga,
    community: row.community,
    category: row.category,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    attachmentName: row.attachment_name || ""
  };
}

app.post("/api/issues", requireSameOrigin, issueUpload.single("attachment"), async (req, res) => {
  const now = Date.now();
  const attempts = (issueSubmissionAttempts.get(req.ip) || []).filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  if (attempts.length >= 5) {
    res.status(429).json({ error: "Too many submissions. Please try again later." });
    return;
  }
  issueSubmissionAttempts.set(req.ip, [...attempts, now]);

  let attachmentPath;
  try {
    const name = readTextField(req.body, "name", "Name", 120, false) || "Not provided";
    const lga = readTextField(req.body, "lga", "LGA", 40);
    const community = readTextField(req.body, "community", "Community", 120);
    const category = readTextField(req.body, "category", "Category", 30);
    const message = readTextField(req.body, "message", "Message", 3000);
    if (!allowedLgas.has(lga)) throw new Error("Select a valid LGA.");
    if (!allowedIssueCategories.has(category)) throw new Error("Select a valid issue category.");
    if (req.body.consent !== "true") throw new Error("Consent is required before submitting an issue.");

    let attachmentName = null;
    if (req.file) {
      const extension = issueAttachmentType(req.file);
      if (!extension) throw new Error("The attachment does not match its declared file type.");
      attachmentPath = path.join(issueAttachmentsDirectory, `${crypto.randomUUID()}${extension}`);
      await fs.promises.writeFile(attachmentPath, req.file.buffer, { flag: "wx" });
      attachmentName = path.basename(req.file.originalname).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || "attachment";
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    database.prepare(`
      INSERT INTO community_issues (id, name, lga, community, category, message,
                                    attachment_path, attachment_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, lga, community, category, message, attachmentPath || null, attachmentName, createdAt);
    res.status(201).json({ submitted: true, id });
  } catch (error) {
    if (attachmentPath) await fs.promises.unlink(attachmentPath).catch((unlinkError) => {
      console.error("Could not remove an issue attachment after failed submission:", unlinkError);
    });
    if (error instanceof Error && !error.code) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Could not save community issue:", error);
    res.status(500).json({ error: "Your issue could not be saved. Please try again." });
  }
});

app.get("/api/admin/issues", requireStaff, (req, res) => {
  res.set("Cache-Control", "no-store");
  const rows = database.prepare(`
    SELECT id, name, lga, community, category, message, attachment_name, status, created_at
    FROM community_issues
    ORDER BY created_at DESC
  `).all();
  res.json({ issues: rows.map(formatIssue) });
});

app.get("/api/admin/issues/:id/attachment", requireStaff, (req, res) => {
  const row = database.prepare("SELECT attachment_path, attachment_name FROM community_issues WHERE id = ?")
    .get(req.params.id);
  if (!row || !row.attachment_path) {
    res.status(404).json({ error: "Issue attachment not found." });
    return;
  }
  const safePath = path.resolve(row.attachment_path);
  if (path.dirname(safePath) !== issueAttachmentsDirectory) {
    res.status(500).json({ error: "Issue attachment path is invalid." });
    return;
  }
  res.download(safePath, row.attachment_name || "issue-attachment", (error) => {
    if (error && !res.headersSent) {
      console.error("Could not send issue attachment:", error);
      res.status(500).json({ error: "Issue attachment could not be downloaded." });
    }
  });
});

// Update an issue
app.patch("/api/admin/issues/:id", requireSameOrigin, requireStaff, (req, res) => {
  try {
    const { name, lga, community, category, message, status } = req.body;
    
    // Validate required fields
    if (name === undefined || name === null) throw new Error("Name is required.");
    if (lga === undefined || lga === null) throw new Error("LGA is required.");
    if (community === undefined || community === null) throw new Error("Community is required.");
    if (category === undefined || category === null) throw new Error("Category is required.");
    if (message === undefined || message === null) throw new Error("Message is required.");
    if (status === undefined || status === null) throw new Error("Status is required.");
    
    // Validate length constraints
    if (name.length > 120) throw new Error("Name must be 120 characters or fewer.");
    if (lga.length > 40) throw new Error("LGA must be 40 characters or fewer.");
    if (community.length > 120) throw new Error("Community must be 120 characters or fewer.");
    if (category.length > 30) throw new Error("Category must be 30 characters or fewer.");
    if (message.length > 3000) throw new Error("Message must be 3000 characters or fewer.");
    
    // Validate LGA
    if (!allowedLgas.has(lga)) throw new Error("Select a valid LGA.");
    
    // Validate category
    if (!allowedIssueCategories.has(category)) throw new Error("Select a valid issue category.");
    
    // Validate status
    const allowedStatuses = new Set(["new", "in progress", "resolved"]);
    if (!allowedStatuses.has(status)) throw new Error("Status must be 'new', 'in progress', or 'resolved'.");
    
    // Update the issue
    const result = database.prepare(`
      UPDATE community_issues 
      SET name = ?, lga = ?, community = ?, category = ?, message = ?, status = ?
      WHERE id = ?
    `).run(name, lga, community, category, message, status, req.params.id);
    
    if (result.changes === 0) {
      res.status(404).json({ error: "Issue not found." });
      return;
    }
    
    // Get the updated issue
    const row = database.prepare(`
      SELECT id, name, lga, community, category, message, attachment_name, status, created_at
      FROM community_issues
      WHERE id = ?
    `).get(req.params.id);
    
    res.json({ issue: formatIssue(row) });
  } catch (error) {
    if (error instanceof Error && !error.code) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Could not update issue:", error);
    res.status(500).json({ error: "The issue could not be updated. Please try again." });
  }
});

// Delete an issue
app.delete("/api/admin/issues/:id", requireSameOrigin, requireStaff, (req, res) => {
  try {
    const result = database.prepare("DELETE FROM community_issues WHERE id = ?")
      .run(req.params.id);
      
    if (result.changes === 0) {
      res.status(404).json({ error: "Issue not found." });
      return;
    }
    
    res.json({ deleted: true });
  } catch (error) {
    console.error("Could not delete issue:", error);
    res.status(500).json({ error: "The issue could not be deleted. Please try again." });
  }
});

app.get("/api/projects", (req, res) => {
  res.set("Cache-Control", "no-store");
  const rows = database.prepare(`
    SELECT id, title, lga, community, sector, year, status, description,
           funding, evidence, image_path, published, created_at, created_by
    FROM projects
    WHERE published = 1
    ORDER BY created_at DESC
  `).all();
  res.json({ projects: rows.map(formatProject) });
});

app.post("/api/auth/login", requireSameOrigin, (req, res) => {
  if (!staffEnabled) {
    res.status(503).json({ error: "Staff sign-in is not configured. Set STAFF_USERNAME and a STAFF_PASSWORD of at least 6 characters." });
    return;
  }
  const key = req.ip;
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.blockedUntil > Date.now()) {
    res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
    return;
  }

  const username = typeof req.body.username === "string" ? req.body.username : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!safeEqual(username, staffUsername) || !safeEqual(password, staffPassword)) {
    const failures = attempt?.blockedUntil && attempt.blockedUntil <= Date.now()
      ? 0
      : (attempt?.failures || 0);
    const nextFailures = failures + 1;
    loginAttempts.set(key, {
      failures: nextFailures,
      blockedUntil: nextFailures >= 5 ? Date.now() + 15 * 60 * 1000 : 0
    });
    res.status(401).json({ error: "Username or password is incorrect." });
    return;
  }

  loginAttempts.delete(key);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { username, expiresAt: Date.now() + sessionDurationMs });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.set("Set-Cookie", `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(sessionDurationMs / 1000)}${secure}`);
  res.json({ authenticated: true, username });
});

app.get("/api/auth/session", (req, res) => {
  const token = getSessionToken(req);
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, username: session.username });
});

app.post("/api/auth/logout", requireSameOrigin, requireStaff, (req, res) => {
  sessions.delete(getSessionToken(req));
  res.set("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  res.json({ authenticated: false });
});

app.get("/api/admin/projects", requireStaff, (req, res) => {
  const rows = database.prepare(`
    SELECT id, title, lga, community, sector, year, status, description,
           funding, evidence, image_path, published, created_at, created_by
    FROM projects
    ORDER BY created_at DESC
  `).all();
  res.json({ projects: rows.map(formatProject) });
});

app.post("/api/admin/projects", requireSameOrigin, requireStaff, upload.single("image"), async (req, res) => {
  let imagePath;
  try {
    const title = readTextField(req.body, "title", "Project title", 120);
    const lga = readTextField(req.body, "lga", "LGA", 40);
    const community = readTextField(req.body, "community", "Community", 120);
    const sector = readTextField(req.body, "sector", "Sector", 30);
    const yearText = readTextField(req.body, "year", "Year", 4);
    const status = readTextField(req.body, "status", "Project status", 20);
    const description = readTextField(req.body, "description", "Description", 2000);
    const funding = readTextField(req.body, "funding", "Funding information", 240, false);
    const evidence = readTextField(req.body, "evidence", "Source or evidence", 500, false);
    const year = Number(yearText);
    if (!allowedLgas.has(lga)) throw new Error("Select a valid LGA.");
    if (!allowedSectors.has(sector)) throw new Error("Select a valid sector.");
    if (!allowedStatuses.has(status)) throw new Error("Select a valid project status.");
    if (!/^\d{4}$/.test(yearText) || year < 1950 || year > 2099) throw new Error("Enter a valid four-digit year.");

    if (req.file) {
      const imageType = imageTypes.get(req.file.mimetype);
      if (!imageType.signature(req.file.buffer)) throw new Error("The uploaded file does not match its declared image type.");
      imagePath = path.join(uploadsDirectory, `${crypto.randomUUID()}${imageType.extension}`);
      await fs.promises.writeFile(imagePath, req.file.buffer, { flag: "wx" });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    database.prepare(`
      INSERT INTO projects (id, title, lga, community, sector, year, status,
                            description, funding, evidence, image_path, published,
                            created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, title, lga, community, sector, year, status, description, funding, evidence, imagePath || null, createdAt, req.staffUsername);

    const row = database.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    res.status(201).json({ project: formatProject(row) });
  } catch (error) {
    if (imagePath) await fs.promises.unlink(imagePath).catch((unlinkError) => {
      console.error("Could not remove an image after a failed project upload:", unlinkError);
    });
    if (error instanceof Error && !error.code) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Could not save uploaded project:", error);
    res.status(500).json({ error: "The project could not be saved. Please try again." });
  }
});

app.patch("/api/admin/projects/:id", requireSameOrigin, requireStaff, (req, res) => {
  if (typeof req.body.published !== "boolean") {
    res.status(400).json({ error: "Published must be true or false." });
    return;
  }
  const result = database.prepare("UPDATE projects SET published = ? WHERE id = ?")
    .run(req.body.published ? 1 : 0, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.json({ updated: true });
});

app.get("/admin", (req, res) => res.sendFile(path.join(siteDirectory, "admin.html")));
app.use("/uploads", express.static(uploadsDirectory, { dotfiles: "deny", index: false, maxAge: "1d" }));
app.use(express.static(siteDirectory, { dotfiles: "deny", index: "index.html" }));

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Project image must be 5 MB or smaller." : "The project image could not be uploaded." });
    return;
  }
  if (error.message === "Issue attachment must be a PDF, JPEG, PNG or WebP file.") {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error.message === "Project image must be a JPEG, PNG or WebP file.") {
    res.status(400).json({ error: error.message });
    return;
  }
  console.error("Unhandled request error:", error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Ekong Sampson Connect is available at http://localhost:${port}`);
    if (!staffEnabled) {
      console.warn("Staff publishing is disabled until STAFF_USERNAME and a STAFF_PASSWORD of at least 6 characters are configured.");
    }
  });
}

module.exports = app;
app.locals.database = database;
