import Groq from "groq-sdk";
import { randomUUID } from "node:crypto";
import { createRateLimiter } from "../lib/rate-limit.js";

const MAX_BODY_BYTES = 64 * 1024;
const PERSONALITIES = {
  normal: "Be calm, educational, concise, and factual.",
  happy: "Be cheerful, playful, and encouraging while keeping facts accurate.",
  angry: "Be grumpy and firm in a playful way. Never insult, bully, or abuse the user.",
};
const PREVIEW_ORIGIN = /^https:\/\/beakspeak-chatbot-[a-z0-9-]+-hamids-projects-6c07675c\.vercel\.app$/;

class RequestError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function validateBody(rawBody) {
  let body = rawBody;
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new RequestError("The request is too large.", 413, "REQUEST_TOO_LARGE");
    try { body = JSON.parse(body.toString()); }
    catch { throw new RequestError("Send a valid JSON object."); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError("Send a JSON object with a text field.");
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) throw new RequestError("The request is too large.", 413, "REQUEST_TOO_LARGE");
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 2000) throw new RequestError("Text must contain 1–2000 characters.");
  const personality = body.personality ?? "normal";
  if (typeof personality !== "string" || !Object.hasOwn(PERSONALITIES, personality)) throw new RequestError("Choose normal, happy, or angry for the personality.");
  if (body.sessionId !== undefined && (typeof body.sessionId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(body.sessionId))) throw new RequestError("Invalid session ID.");
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 12 || history.length % 2 !== 0) throw new RequestError("History must contain at most six complete conversation turns.");
  let historyChars = 0;
  const safeHistory = history.map((message, index) => {
    const role = index % 2 === 0 ? "user" : "assistant";
    if (!message || message.role !== role || typeof message.content !== "string" || !message.content.trim() || message.content.length > 4000) throw new RequestError("History must alternate user and assistant messages with valid text.");
    historyChars += message.content.length;
    return { role, content: message.content.trim() };
  });
  if (historyChars > 12000) throw new RequestError("Conversation history is too long.");
  return { text: body.text.trim(), personality, history: safeHistory };
}

export function classifyProviderError(error) {
  const status = error?.status;
  if (error?.name === "APIConnectionTimeoutError" || error?.name === "AbortError") return { status: 504, code: "PROVIDER_TIMEOUT", message: "BeakSpeak took too long to respond. Please try again." };
  if (status === 401) return { status: 503, code: "PROVIDER_KEY_REJECTED", message: "Chat is temporarily unavailable. The service configuration needs attention." };
  if (status === 403) return { status: 503, code: "PROVIDER_ACCESS_DENIED", message: "Chat is temporarily unavailable. The service configuration needs attention." };
  if (status === 429) return { status: 429, code: "PROVIDER_RATE_LIMIT", message: "BeakSpeak is busy. Please wait a minute before trying again." };
  if (status === 400 || status === 404 || status === 422) return { status: 503, code: "PROVIDER_CONFIG_ERROR", message: "Chat is temporarily unavailable. The service configuration needs attention." };
  return { status: 502, code: "PROVIDER_UNAVAILABLE", message: "BeakSpeak could not reach its AI service. Please try again shortly." };
}

export function createHandler({ env = process.env, createClient = (options) => new Groq(options), limiter = createRateLimiter({ env }), logger = console, uuid = randomUUID } = {}) {
  return async function handler(req, res) {
    const requestId = uuid();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "X-Request-Id, Retry-After");
    const fail = (status, code, message) => res.status(status).json({ error: message, code, requestId });
    const origin = req.headers?.origin;
    const origins = new Set(["https://beakspeak-chatbot.vercel.app", ...(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean)]);
    if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
      origins.add("http://localhost:3000");
      origins.add("http://127.0.0.1:3000");
    }
    if (origin && !origins.has(origin) && !PREVIEW_ORIGIN.test(origin)) return fail(403, "ORIGIN_NOT_ALLOWED", "This website is not allowed to use this endpoint.");
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST, OPTIONS");
      return fail(405, "METHOD_NOT_ALLOWED", "Use POST to send a chat message.");
    }

    let model;
    try {
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers?.["content-type"] || "")) throw new RequestError("Send the request as application/json.", 415, "UNSUPPORTED_MEDIA_TYPE");
      if (Number(req.headers?.["content-length"]) > MAX_BODY_BYTES) throw new RequestError("The request is too large.", 413, "REQUEST_TOO_LARGE");
      const { text, personality, history } = validateBody(req.body);
      if (!env.GROQ_API_KEY?.trim()) {
        logger.error(JSON.stringify({ event: "chat_config_error", requestId, code: "MISSING_API_KEY" }));
        return fail(503, "SERVICE_NOT_CONFIGURED", "Chat is temporarily unavailable. The service configuration needs attention.");
      }
      const limit = await limiter.check(req);
      if (!limit.allowed) {
        res.setHeader("Retry-After", String(limit.retryAfter));
        return fail(429, "RATE_LIMITED", "Too many messages. Please wait before trying again.");
      }
      model = env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
      const client = createClient({ apiKey: env.GROQ_API_KEY, timeout: 20000, maxRetries: 0 });
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: `You are BeakSpeak, a helpful expert on hooded vultures. ${PERSONALITIES[personality]} Keep replies short unless the user asks for detail. Refer to Senegal and West African habitats when relevant. If uncertain, say so instead of inventing facts.` },
          ...history,
          { role: "user", content: text },
        ],
        max_completion_tokens: 1024,
        ...(model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low", include_reasoning: false } : {}),
      });
      const reply = response?.choices?.[0]?.message?.content;
      if (typeof reply !== "string" || !reply.trim() || reply.length > 4000) {
        logger.error(JSON.stringify({ event: "chat_invalid_response", requestId, model }));
        return fail(502, "INVALID_PROVIDER_RESPONSE", "BeakSpeak received an empty or invalid response. Please try again.");
      }
      return res.status(200).json({ reply: reply.trim(), requestId });
    } catch (error) {
      if (error instanceof RequestError) return fail(error.status, error.code, error.message);
      const failure = error?.code === "RATE_LIMIT_UNAVAILABLE"
        ? { status: 503, code: "RATE_LIMIT_UNAVAILABLE", message: "Chat is temporarily unavailable. Please try again shortly." }
        : classifyProviderError(error);
      // Exclude prompts, credentials, raw SDK objects, and provider error messages.
      const providerCode = error?.error?.code ?? error?.code;
      logger.error(JSON.stringify({ event: "chat_failed", requestId, code: failure.code, model, providerStatus: Number.isInteger(error?.status) ? error.status : undefined, providerCode: typeof providerCode === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(providerCode) ? providerCode : undefined, providerRequestId: typeof error?.request_id === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(error.request_id) ? error.request_id : undefined }));
      if (failure.status === 429) res.setHeader("Retry-After", "60");
      return fail(failure.status, failure.code, failure.message);
    }
  };
}

export default createHandler();
