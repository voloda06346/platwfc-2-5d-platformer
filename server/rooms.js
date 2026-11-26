const ROOM_CAPACITY = 16;

export class RoomManager {
  constructor() { this.rooms = new Map(); }

  join(client, requestedRoom = "lobby") {
    const roomId = String(requestedRoom).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "lobby";
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { id: roomId, clients: new Map() };
      this.rooms.set(roomId, room);
    }
    if (room.clients.size >= ROOM_CAPACITY) return null;
    room.clients.set(client.id, client);
    client.roomId = roomId;
    return room;
  }

  leave(client) {
    if (!client.roomId) return null;
    const room = this.rooms.get(client.roomId);
    if (!room) { client.roomId = null; return null; }
    room.clients.delete(client.id);
    const roomId = room.id;
    if (room.clients.size === 0) this.rooms.delete(roomId);
    client.roomId = null;
    return { roomId, remaining: [...room.clients.values()] };
  }

  peers(roomId, exceptId) {
    const room = this.rooms.get(roomId);
    return room ? [...room.clients.values()].filter(peer => peer.id !== exceptId) : [];
  }

  snapshot(roomId) {
    const room = this.rooms.get(roomId);
    return room ? [...room.clients.values()].map(c => ({ id: c.id, name: c.name, x: c.state.x, z: c.state.z, y: c.state.y, facing: c.state.facing })) : [];
  }
}