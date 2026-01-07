import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  color: string;
  name: string;
}

const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"];
const NAMES = ["Anonymous Ant", "Busy Beaver", "Cool Cat", "Daring Dog", "Eager Eagle"];

const clients = new Set<ConnectedClient>();

console.log("Collab Server running on port 8080");

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  
  const client = { ws, id, color, name };
  clients.add(client);

  ws.send(JSON.stringify({
    type: "init",
    payload: { id, color, name }
  }));

  ws.on('message', (message) => {
    const raw = message.toString();
    const data = JSON.parse(raw);

    if (data.type === "cursor") {
      data.payload.clientId = id;
      data.payload.color = color;
      data.payload.name = name;
    }

    const broadcastData = JSON.stringify(data);

    for (const c of clients) {
      if (c.id !== id && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(broadcastData);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(client);
    const disconnectMsg = JSON.stringify({ type: "client_disconnect", payload: { clientId: id } });
    for (const c of clients) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(disconnectMsg);
    }
  });
});