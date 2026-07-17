import { IncomingMessage } from "http";
import wss from "./server";
import Stream from "stream";
import { WebSocketConnection } from "./connection";
import { config } from "@/config/index";

/**
 * @openapi
 * /api/v2/ws/quote:
 *   get:
 *     summary: WebSocket subscription for real-time mint quote updates
 *     description: |
 *       Upgrade to a WebSocket connection to receive push notifications whenever
 *       a mint quote owned by the authenticated pubkey transitions state
 *       (`UNPAID` → `PAID` → `ISSUED`).
 *
 *       ## Authentication
 *
 *       Authentication uses a NIP-98 challenge/response flow. The client must
 *       complete the handshake within **15 seconds** of connecting or the server
 *       closes the socket.
 *
 *       ### Server → Client (immediately after upgrade)
 *       ```json
 *       { "type": "challenge", "payload": { "url": "wss://host/api/v2/ws/quote", "method": "GET" } }
 *       ```
 *
 *       ### Client → Server (NIP-98 challenge-response)
 *       The `payload` field MUST be a NIP-98 base64 token **prefixed with
 *       the literal string `"Nostr "`** (a single space after the word).
 *       ```json
 *       {
 *         "type": "challenge-response",
 *         "payload": "Nostr eyJraW5kIjoyNzIzNSwidWMiOi..."
 *       }
 *       ```
 *       Omitting the `Nostr ` prefix causes `verifyAuth` to reject the token
 *       and the connection is closed after the 15-second auth timeout.
 *
 *       ### Server → Client (on success)
 *       ```json
 *       { "type": "challenge-success" }
 *       ```
 *
 *       ## Server-pushed updates
 *       ```json
 *       { "type": "update", "payload": { "quoteId": "<mint quote id>" } }
 *       ```
 *
 *       ## Keep-alive
 *       The client SHOULD send `{"type":"ping"}` periodically. The server
 *       replies with `{"type":"pong"}`. The server does not initiate pings.
 *
 *       ## Close codes
 *       - `1000` — normal closure (including auth timeout via `close()`)
 *       - `1001` — going away
 *
 *     tags: [WebSocket]
 *     responses:
 *       101:
 *         description: Switching Protocols (WebSocket upgrade)
 *       400:
 *         description: Invalid WebSocket path
 */
export function websocketUpgradeController(
  req: IncomingMessage,
  socket: Stream.Duplex,
  head: Buffer,
) {
  const websocketPath = "/api/v2/ws/quote";
  if (req.url === websocketPath) {
    const host = req.headers.host;
    const protocol = config.nodeEnv === "production" ? "wss" : "ws";
    const url = `${protocol}://${host}${websocketPath}`;
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = new WebSocketConnection(ws, url);
      wss.emit("connection", ws, req, conn);
    });
  } else {
    socket.destroy();
  }
}
