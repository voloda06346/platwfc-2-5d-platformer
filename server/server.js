import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { RoomManager } from "./rooms.js";
import { broadcast, parseMessage, send } from "./network.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const rooms = new RoomManager();
const clients = new Map();
const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ service: "PLATWFC", status: "ok", online: clients.size, rooms: rooms.rooms.size }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("PLATWFC realtime server is running.\n");
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
    id: randomUUID(), socket, name: "Player", roomId: null,
    state: { x: 0, z: 0, y: 0, facing: 0 },
    lastUpdate: 0, alive: true
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
      if (!room) { send(socket, { type: "error", code: "ROOM_FULL", message: "Room is full" }); return; }
      send(socket, { type: "joined", room: room.id, players: rooms.snapshot(room.id) });
      broadcast(rooms.peers(room.id, client.id), { type: "peer-joined", player: { id: client.id, name: client.name, ...client.state } });
      return;
    }

    if (message.type === "state" && client.roomId) {
      const now = Date.now();
      if (now - client.lastUpdate < 40) return;
      client.lastUpdate = now;
      client.state = {
        x: validPosition(message.x), z: validPosition(message.z),
        y: Math.max(0, Math.min(100, validPosition(message.y))),
        facing: validPosition(message.facing)
      };
      broadcast(rooms.peers(client.roomId, client.id), {
        type: "peer-state", player: { id: client.id, name: client.name, ...client.state }
      });
    }
  });

  socket.on("close", () => { leave(client); clients.delete(client.id); });
  socket.on("error", () => { leave(client); clients.delete(client.id); });
});

const heartbeat = setInterval(() => {
  for (const client of clients.values()) {
    if (client.alive === false) { client.socket.terminate(); continue; }
    client.alive = false;
    client.socket.ping();
  }
}, 30000);
wss.on("connection", socket => {
  socket.on("pong", () => {
    for (const client of clients.values()) if (client.socket === socket) client.alive = true;
  });
});
http.listen(PORT, HOST, () => console.log(`PLATWFC listening on ${HOST}:${PORT}`));
process.on("SIGTERM", () => { clearInterval(heartbeat); wss.close(); http.close(); });