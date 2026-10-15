"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ekong-project-test-"));
const databasePath = path.join(temporaryDirectory, "projects.sqlite");
process.env.PROJECT_DATA_DIR = temporaryDirectory;
process.env.PROJECT_DB_PATH = databasePath;
process.env.STAFF_USERNAME = "project-team";
process.env.STAFF_PASSWORD = "abc123";
process.env.NODE_ENV = "test";

const app = require("../server");
let server;
let baseUrl;
let staffCookie;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  app.locals.database.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("published projects are public while project management requires staff sign-in", async () => {
  const publicResponse = await fetch(`${baseUrl}/api/projects`);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get("cache-control"), "no-store");
  assert.deepEqual((await publicResponse.json()).projects, []);

  const unauthorizedResponse = await fetch(`${baseUrl}/api/admin/projects`);
  assert.equal(unauthorizedResponse.status, 401);
});

test("staff can publish, persist, and unpublish a project", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ username: "project-team", password: "abc123" })
  });
  assert.equal(loginResponse.status, 200);
  staffCookie = loginResponse.headers.get("set-cookie").split(";")[0];

  const form = new FormData();
  form.set("title", "Community Health Centre");
  form.set("lga", "eket");
  form.set("community", "Ikot Udoma");
  form.set("sector", "health");
  form.set("year", "2025");
  form.set("status", "ongoing");
  form.set("description", "Renovation and equipment for the community health centre.");
  form.set("funding", "Public project information");
  form.set("evidence", "Project team update");
  const createResponse = await fetch(`${baseUrl}/api/admin/projects`, {
    method: "POST",
    headers: { Origin: baseUrl, Cookie: staffCookie },
    body: form
  });
  assert.equal(createResponse.status, 201);
  const { project } = await createResponse.json();
  assert.equal(project.published, true);
  assert.equal(project.community, "Ikot Udoma");

  const publicProjects = await (await fetch(`${baseUrl}/api/projects`)).json();
  assert.equal(publicProjects.projects.length, 1);
  assert.equal(publicProjects.projects[0].title, "Community Health Centre");

  const { DatabaseSync } = require("node:sqlite");
  const persistedDatabase = new DatabaseSync(databasePath);
  assert.equal(persistedDatabase.prepare("SELECT COUNT(*) AS count FROM projects").get().count, 1);
  persistedDatabase.close();

  const unpublishResponse = await fetch(`${baseUrl}/api/admin/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: staffCookie },
    body: JSON.stringify({ published: false })
  });
  assert.equal(unpublishResponse.status, 200);
  assert.deepEqual((await (await fetch(`${baseUrl}/api/projects`)).json()).projects, []);

  const adminProjects = await (await fetch(`${baseUrl}/api/admin/projects`, {
    headers: { Cookie: staffCookie }
  })).json();
  assert.equal(adminProjects.projects[0].published, false);
});
