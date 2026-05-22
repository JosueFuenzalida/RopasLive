import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const backupDir = join(dataDir, "backups");
const syncFile = join(dataDir, "sync-log.json");
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

await mkdir(backupDir, { recursive: true });
if (!existsSync(syncFile)) {
  await writeFile(syncFile, "[]", "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000_000) {
        reject(new Error("Payload demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function appendSyncEvents(events) {
  const current = JSON.parse(await readFile(syncFile, "utf8"));
  current.push(...events);
  await writeFile(syncFile, JSON.stringify(current, null, 2), "utf8");
}

function safeBackupName(name) {
  return String(name || `backup-${Date.now()}.json`).replace(/[^a-z0-9._-]/gi, "-");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, at: new Date().toISOString() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/sync") {
      const payload = JSON.parse(await readBody(req) || "{}");
      const events = Array.isArray(payload.events) ? payload.events : [];
      await appendSyncEvents(events.map((event) => ({ ...event, syncedAt: new Date().toISOString() })));
      sendJson(res, 200, { ok: true, accepted: events.length });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/backups") {
      const payload = JSON.parse(await readBody(req) || "{}");
      const filename = safeBackupName(payload.filename);
      await writeFile(join(backupDir, filename), JSON.stringify(payload.backup || payload, null, 2), "utf8");
      sendJson(res, 200, { ok: true, filename });
      return;
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const fullPath = normalize(join(publicDir, pathname));
    if (!fullPath.startsWith(publicDir) || !existsSync(fullPath)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("No encontrado");
      return;
    }

    res.writeHead(200, { "content-type": mime[extname(fullPath)] || "application/octet-stream" });
    createReadStream(fullPath).pipe(res);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Live Commerce listo en http://localhost:${port}`);
});
