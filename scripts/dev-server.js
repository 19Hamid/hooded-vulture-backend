import http from "node:http";
import handler from "../api/chat.js";

const server = http.createServer(async (req, res) => {
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (body) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
  if (req.url !== "/api/chat") return res.status(404).json({ error: "Not found" });
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 64 * 1024) return res.status(413).json({ error: "The request is too large." });
  }
  req.body = body;
  await handler(req, res);
});
server.listen(3001, "0.0.0.0", () => console.log("BeakSpeak backend: http://localhost:3001/api/chat"));
