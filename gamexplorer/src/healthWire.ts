import { createConnection } from "node:net";

export class HealthWireError extends Error {
  constructor(readonly reason: "TIMEOUT" | "TOO_LARGE" | "RESPONSE_INVALID") {
    super(`Health HTTP verification failed: ${reason}.`);
  }
}

/** Check real HTTP bytes and EOF; a handler returning a Response is not sufficient. */
export function checkHealthWire(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const chunks: Buffer[] = [];
    let length = 0;
    const deadline = setTimeout(() => {
      socket.destroy(new HealthWireError("TIMEOUT"));
    }, 1000);
    socket.on("connect", () => {
      socket.write(`GET /health HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: keep-alive\r\n\r\n`);
    });
    socket.on("data", chunk => {
      length += chunk.length;
      if (length > 4096) {
        socket.destroy(new HealthWireError("TOO_LARGE"));
      } else {
        chunks.push(chunk);
      }
    });
    socket.on("error", reject);
    socket.on("close", () => { clearTimeout(deadline); });
    socket.on("end", () => {
      clearTimeout(deadline);
      const wire = Buffer.concat(chunks).toString("utf8");
      const split = wire.indexOf("\r\n\r\n");
      const headers = wire.slice(0, split).toLowerCase();
      const body = wire.slice(split + 4);
      if (!/^HTTP\/1\.[01] 200(?: |\r\n)/.test(wire) || split === -1 ||
          !/\r\nconnection: close(?:\r\n|$)/.test(headers) ||
          !/\r\ncontent-length: 15(?:\r\n|$)/.test(headers) ||
          !/\r\ncache-control: no-store(?:\r\n|$)/.test(headers) || body !== '{"status":"ok"}') {
        reject(new HealthWireError("RESPONSE_INVALID"));
      } else {
        resolve();
      }
    });
  });
}
