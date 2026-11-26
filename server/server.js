import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { RoomManager } from "./rooms.js";
import { broadcast, parseMessage, send } from "./network.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rooms = new RoomManager();
const clients = new Map();

// Only the game client files are served. Server code, .env, Git data and
// node_modules are never exposed through the static file endpoint.
const PUBLIC_FILES = new Set([
  "/index.html",
  "/style.css",
  "/src/game.js",
  "/src/multiplayer.js"
]);
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

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
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(JSON.stringify({
      service: "PLATWFC",
      status: "ok",
      online: clients.size,
      rooms: rooms.rooms.size
    }));
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      "content-type": "text/plain; charset=utf-8",
      "allow": "GET, HEAD"
    });
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
  return String(value || "Player").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 16) || "Player";
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

http.listen(PORT, HOST, () => {
  console.log(`PLATWFC listening on ${HOST}:${PORT}`);
  console.log(`Game: http://localhost:${PORT}/`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});

process.on("SIGTERM", () => {
  clearInterval(heartbeat);
  wss.close();
  http.close();
});
