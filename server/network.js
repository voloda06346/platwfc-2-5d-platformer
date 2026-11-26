export function send(socket, payload) {
  if (socket.readyState === 1) socket.send(JSON.stringify(payload));
}

export function broadcast(clients, payload) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.socket.readyState === 1) client.socket.send(message);
  }
}

export function parseMessage(raw) {
  try {
    const value = JSON.parse(raw.toString());
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}