import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { RoomManager } from "./rooms.js";
import { broadcast, parseMessage, send } from "./network.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DLC_DIR = resolve(PROJECT_ROOT, "dlc-workshop");
const MAX_ADDON_BYTES = 64 * 1024;
const rooms = new RoomManager();
const clients = new Map();

const PUBLIC_FILES = new Set([
  "/index.html",
  "/style.css",
  "/src/game.js",
  "/src/multiplayer.js",
  "/src/audio.js"
]);
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes = MAX_ADDON_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Upload is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function safeText(value, fallback, maxLength) {
  return String(value ?? fallback)
    .replace(/[<>\u0000-\u001f]/g, "")
    .trim()
    .slice(0, maxLength) || fallback;
}

function validateAddon(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Add-on must be a JSON object");
  }

  const id = String(input.id || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) {
    throw new Error("id must use 2–40 lowercase letters, digits or hyphens");
  }

  const type = String(input.type || "");
  if (!["level", "cosmetic", "music"].includes(type)) {
    throw new Error("type must be level, cosmetic or music");
  }

  const addon = {
    schema: 1,
    id,
    name: safeText(input.name, "Untitled add-on", 48),
    author: safeText(input.author, "Community", 32),
    version: safeText(input.version, "1.0.0", 16),
    description: safeText(input.description, "Community add-on for PLATWFC.", 180),
    type
  };

  if (type === "level") {
    if (!Array.isArray(input.platforms) || input.platforms.length < 1 || input.platforms.length > 24) {
      throw new Error("level add-ons need 1–24 platforms");
    }
    addon.platforms = input.platforms.map((platform, index) => {
      if (!platform || typeof platform !== "object") throw new Error(`platform ${index + 1} is invalid`);
      const number = (key, min, max) => {
        const value = Number(platform[key]);
        if (!Number.isFinite(value) || value < min || value > max) {
          throw new Error(`platform ${index + 1}: ${key} is out of range`);
        }
        return value;
      };
      const color = String(platform.color || "#70d49a");
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error(`platform ${index + 1}: color must be #RRGGBB`);
      return {
        x: number("x", -200, 200),
        z: number("z", -200, 200),
        width: number("width", 1, 24),
        depth: number("depth", 1, 24),
        height: number("height", -5, 60),
        color
      };
    });
  }

  if (type === "cosmetic") {
    const bodyColor = String(input.bodyColor || "#3b9d9a");
    const accentColor = String(input.accentColor || "#ffd36e");
    if (!/^#[0-9a-fA-F]{6}$/.test(bodyColor) || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      throw new Error("cosmetic colors must use #RRGGBB format");
    }
    addon.bodyColor = bodyColor;
    addon.accentColor = accentColor;
  }

  if (type === "music") {
    const mood = String(input.mood || "adventure");
    if (!["adventure", "sunset", "arcade"].includes(mood)) {
      throw new Error("music mood must be adventure, sunset or arcade");
    }
    addon.mood = mood;
  }

  return addon;
}

async function listAddons() {
  await mkdir(DLC_DIR, { recursive: true });
  const entries = await readdir(DLC_DIR, { withFileTypes: true });
  const addons = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    try {
      const data = JSON.parse(await readFile(resolve(DLC_DIR, entry.name), "utf8"));
      const addon = validateAddon(data);
      addons.push(addon);
    } catch {
      // Ignore files that do not match the supported, safe add-on schema.
    }
  }
  return addons.sort((a, b) => a.name.localeCompare(b.name));
}

const http = createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  } catch {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad request\n");
    return;
  }

  if (url.pathname === "/health") {
    sendJson(res, 200, {
      service: "PLATWFC",
      status: "ok",
      online: clients.size,
      rooms: rooms.rooms.size
    });
    return;
  }

  if (url.pathname === "/api/workshop") {
    if (req.method === "GET") {
      try {
        const addons = await listAddons();
        sendJson(res, 200, { folder: "dlc-workshop", addons });
      } catch {
        sendJson(res, 500, { error: "Could not read the local workshop folder" });
      }
      return;
    }

    if (req.method === "POST") {
      try {
        const input = await readJsonBody(req);
        const addon = validateAddon(input);
        await mkdir(DLC_DIR, { recursive: true });
        const target = resolve(DLC_DIR, `${addon.id}.json`);
        try {
          await stat(target);
          sendJson(res, 409, { error: "An add-on with this id is already installed" });
          return;
        } catch {}
        await writeFile(target, JSON.stringify(addon, null, 2), { encoding: "utf8", flag: "wx" });
        sendJson(res, 201, {
          installed: true,
          folder: "dlc-workshop",
          addon
        });
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: error.message || "Add-on import failed" });
      }
      return;
    }

    res.writeHead(405, { "content-type": "application/json; charset=utf-8", "allow": "GET, POST" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8", "allow": "GET, HEAD" });
    res.end("Method not allowed\n");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad request\n");
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  if (!PUBLIC_FILES.has(pathname)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("PLATWFC file not found\n");
    return;
  }

  const filePath = resolve(PROJECT_ROOT, "." + pathname);
  if (!filePath.startsWith(PROJECT_ROOT + sep)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden\n");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "content-length": body.length,
      "x-content-type-options": "nosniff",
      "cache-control": "no-cache"
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("PLATWFC file not found\n");
  }
});

const wss = new WebSocketServer({ server: http, path: "/ws", maxPayload: 2048 });

function cleanName(value) {
  return safeText(value, "Player", 16);
}
function validPosition(value) {
  return Number.isFinite(value) ? Math.max(-10000, Math.min(10000, value)) : 0;
}
function leave(client) {
  const result = rooms.leave(client);
  if (!result) return;
  broadcast(result.remaining, { type: "peer-left", id: client.id });
}

wss.on("connection", socket => {
  const client = {
    id: randomUUID(),
    socket,
    name: "Player",
    roomId: null,
    state: { x: 0, z: 0, y: 0, facing: 0 },
    lastUpdate: 0,
    alive: true
  };
  clients.set(client.id, client);
  send(socket, { type: "welcome", id: client.id, service: "PLATWFC", protocol: 1 });

  socket.on("message", raw => {
    const message = parseMessage(raw);
    if (!message || typeof message.type !== "string") return;

    if (message.type === "join") {
      leave(client);
      client.name = cleanName(message.name);
      const room = rooms.join(client, message.room);
      if (!room) {
        send(socket, { type: "error", code: "ROOM_FULL", message: "Room is full" });
        return;
      }
      send(socket, { type: "joined", room: room.id, players: rooms.snapshot(room.id) });
      broadcast(rooms.peers(room.id, client.id), {
        type: "peer-joined",
        player: { id: client.id, name: client.name, ...client.state }
      });
      return;
    }

    if (message.type === "state" && client.roomId) {
      const now = Date.now();
      if (now - client.lastUpdate < 40) return;
      client.lastUpdate = now;
      const allowedActions = new Set(["idle", "run", "sprint", "jump", "longJump", "dive", "groundPound", "roll"]);
      client.state = {
        x: validPosition(message.x),
        z: validPosition(message.z),
        y: Math.max(0, Math.min(100, validPosition(message.y))),
        facing: validPosition(message.facing),
        speed: Math.max(0, Math.min(14, validPosition(message.speed))),
        grounded: message.grounded !== false,
        action: allowedActions.has(message.action) ? message.action : "idle"
      };
      broadcast(rooms.peers(client.roomId, client.id), {
        type: "peer-state",
        player: { id: client.id, name: client.name, ...client.state }
      });
    }
  });

  socket.on("close", () => {
    leave(client);
    clients.delete(client.id);
  });
  socket.on("error", () => {
    leave(client);
    clients.delete(client.id);
  });
});

const heartbeat = setInterval(() => {
  for (const client of clients.values()) {
    if (client.alive === false) {
      client.socket.terminate();
      continue;
    }
    client.alive = false;
    client.socket.ping();
  }
}, 30000);

wss.on("connection", socket => {
  socket.on("pong", () => {
    for (const client of clients.values()) {
      if (client.socket === socket) client.alive = true;
    }
  });
});

await mkdir(DLC_DIR, { recursive: true });

http.listen(PORT, HOST, () => {
  console.log(`PLATWFC listening on ${HOST}:${PORT}`);
  console.log(`Game: http://localhost:${PORT}/`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Workshop: http://localhost:${PORT}/api/workshop`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log("DLC folder: " + DLC_DIR);
});

process.on("SIGTERM", () => {
  clearInterval(heartbeat);
  wss.close();
  http.close();
});
