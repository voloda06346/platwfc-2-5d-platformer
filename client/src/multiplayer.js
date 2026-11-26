export class MultiplayerClient extends EventTarget {
  constructor() {
    super();
    this.socket = null;
    this.id = null;
    this.connected = false;
    this.peers = new Map();
    this.lastSent = 0;
    this.room = "lobby";
    this.name = "Player";
  }

  connect(url, { name = "Player", room = "lobby" } = {}) {
    if (!url) return;
    this.name = String(name).slice(0, 16);
    this.room = String(room).slice(0, 24);
    try {
      this.socket = new WebSocket(url);
      this.socket.addEventListener("open", () => {
        this.connected = true;
        this.socket.send(JSON.stringify({ type: "join", name: this.name, room: this.room }));
        this.dispatchEvent(new Event("connected"));
      });
      this.socket.addEventListener("message", event => this.onMessage(event.data));
      this.socket.addEventListener("close", () => {
        this.connected = false;
        this.peers.clear();
        this.dispatchEvent(new Event("disconnected"));
      });
      this.socket.addEventListener("error", () => this.dispatchEvent(new Event("disconnected")));
    } catch (error) {
      console.warn("PLATWFC connection failed:", error);
      this.dispatchEvent(new Event("disconnected"));
    }
  }

  onMessage(raw) {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.type === "welcome") this.id = message.id;
    if (message.type === "joined") {
      this.peers.clear();
      for (const player of message.players || []) if (player.id !== this.id) this.peers.set(player.id, player);
      this.dispatchEvent(new CustomEvent("room-joined", { detail: message.room }));
    }
    if (message.type === "peer-joined" || message.type === "peer-state") {
      const p = message.player;
      if (p && p.id !== this.id) this.peers.set(p.id, p);
      this.dispatchEvent(new Event("players-changed"));
    }
    if (message.type === "peer-left") {
      this.peers.delete(message.id);
      this.dispatchEvent(new Event("players-changed"));
    }
    if (message.type === "error") console.warn("PLATWFC:", message.message);
  }

  sendState(state) {
    const now = performance.now();
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN || now - this.lastSent < 50) return;
    this.lastSent = now;
    this.socket.send(JSON.stringify({ type: "state", x: state.x, z: state.z, y: state.y, facing: state.facing || 0 }));
  }
}