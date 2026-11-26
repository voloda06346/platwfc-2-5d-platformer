export class MultiplayerClient extends EventTarget {
  constructor() {
    super();
    this.socket = null;
    this.id = null;
    this.connected = false;
    this.joined = false;
    this.peers = new Map();
    this.lastSent = 0;
  }

  connect(url, { name = "Player", room = "lobby" } = {}) {
    if (!url) return;
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close();
    }

    this.joined = false;
    this.dispatchEvent(new Event("connecting"));

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.addEventListener("open", () => {
        if (this.socket !== socket) return;
        this.connected = true;
        socket.send(JSON.stringify({
          type: "join",
          name: String(name).slice(0, 16),
          room: String(room).slice(0, 24)
        }));
      });

      socket.addEventListener("message", event => {
        if (this.socket === socket) this.onMessage(event.data);
      });

      socket.addEventListener("close", () => {
        if (this.socket !== socket) return;
        this.connected = false;
        this.joined = false;
        this.peers.clear();
        this.dispatchEvent(new Event("disconnected"));
        this.dispatchEvent(new Event("players-changed"));
      });

      socket.addEventListener("error", () => {
        if (this.socket === socket) {
          this.dispatchEvent(new Event("connection-error"));
        }
      });
    } catch (error) {
      console.warn("PLATWFC connection failed:", error);
      this.connected = false;
      this.joined = false;
      this.dispatchEvent(new Event("connection-error"));
      this.dispatchEvent(new Event("disconnected"));
    }
  }

  onMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.type === "welcome") {
      this.id = message.id;
      return;
    }

    if (message.type === "joined") {
      this.joined = true;
      this.peers.clear();
      for (const player of message.players || []) {
        if (player.id !== this.id) this.peers.set(player.id, player);
      }
      this.dispatchEvent(new Event("connected"));
      this.dispatchEvent(new Event("players-changed"));
      return;
    }

    if (message.type === "peer-joined" || message.type === "peer-state") {
      const player = message.player;
      if (player && player.id !== this.id) {
        this.peers.set(player.id, player);
        this.dispatchEvent(new Event("players-changed"));
      }
      return;
    }

    if (message.type === "peer-left") {
      this.peers.delete(message.id);
      this.dispatchEvent(new Event("players-changed"));
      return;
    }

    if (message.type === "error") {
      console.warn("PLATWFC:", message.message || message.code);
      this.dispatchEvent(new CustomEvent("server-error", {
        detail: { code: message.code, message: message.message }
      }));
    }
  }

  sendState(state) {
    const now = performance.now();
    if (
      !this.joined ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      now - this.lastSent < 50
    ) return;

    this.lastSent = now;
    this.socket.send(JSON.stringify({
      type: "state",
      x: state.x,
      z: state.z,
      y: state.y,
      facing: state.facing || 0
    }));
  }

  disconnect() {
    if (this.socket) this.socket.close();
    this.socket = null;
    this.connected = false;
    this.joined = false;
    this.peers.clear();
  }
}
