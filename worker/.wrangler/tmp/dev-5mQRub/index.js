var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var MAX_BODY_BYTES = 12 * 1024 * 1024;
var PROMPT_MAX_CHARS = 1e3;
var CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
var IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
var STYLE = "soft watercolour illustration, warm ivory and forest-green palette, gentle light, calm journal mood, no text, no logos, no recognisable real people";
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}
__name(json, "json");
function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
__name(httpError, "httpError");
async function readJson(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) throw httpError(413, "Request body too large");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw httpError(413, "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, "Body must be valid JSON");
  }
}
__name(readJson, "readJson");
function getUserId(request, body = null) {
  const headerUid = request.headers.get("x-user-id");
  if (headerUid && headerUid.trim()) return headerUid.trim();
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token.slice(0, 36);
  }
  if (body && typeof body.user_id === "string" && body.user_id.trim()) {
    return body.user_id.trim();
  }
  return "default_user";
}
__name(getUserId, "getUserId");
async function handlePrompt(request, env) {
  const body = await readJson(request);
  const transcript = typeof body.transcript === "string" ? body.transcript : "";
  if (!transcript.trim()) throw httpError(400, "transcript is required");
  const messages = [
    {
      role: "system",
      content: 'You write ONE English image prompt for a diary illustration. Rules: at most 60 words; always in this exact style: "' + STYLE + '"; describe only the setting, objects and mood of the diary entry; output the prompt text only, nothing else.'
    },
    {
      role: "user",
      content: `Diary language: ${body.language || "unknown"}
Diary entry:
${transcript.slice(0, PROMPT_MAX_CHARS)}`
    }
  ];
  const out = await env.AI.run(CHAT_MODEL, { messages, max_tokens: 120 });
  const prompt = (out?.response || "").trim().split("\n")[0].trim().slice(0, 500);
  if (!prompt) throw httpError(502, "The model returned an empty prompt");
  return json({ prompt });
}
__name(handlePrompt, "handlePrompt");
async function handleImage(request, env) {
  const body = await readJson(request);
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) throw httpError(400, "prompt is required");
  const out = await env.AI.run(IMAGE_MODEL, { prompt: prompt.slice(0, 2e3) });
  const b64 = out?.image;
  if (!b64) throw httpError(502, "Image generation failed");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      ...CORS,
      "Content-Type": "image/png",
      "Cache-Control": "no-store"
    }
  });
}
__name(handleImage, "handleImage");
async function handleSaveEntry(request, env) {
  if (!env.DB) throw httpError(500, 'D1 database binding "DB" is not configured');
  const body = await readJson(request);
  const userId = getUserId(request, body);
  const id = String(body.id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) throw httpError(400, "transcript is required");
  const title = (body.title || "Untitled memory").slice(0, 200);
  const entryDate = body.entry_date || body.entryDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const language = body.language || "en-US";
  const mood = body.mood || "";
  const illustrationPrompt = body.illustration_prompt || body.illustrationPrompt || "";
  const imageKey = body.image_key || body.imageKey || "";
  const audioDuration = Number(body.audio_duration || body.duration || 0);
  const audioType = body.audio_type || body.audioType || "audio/webm";
  let audioKey = body.audio_key || body.audioKey || null;
  if (body.audio_base64 && typeof body.audio_base64 === "string") {
    try {
      const ext = audioType.includes("wav") ? "wav" : audioType.includes("mp4") ? "mp4" : "webm";
      audioKey = `audio_${userId}_${id}_${Date.now()}.${ext}`;
      if (env.AUDIO_BUCKET) {
        const binaryString = atob(body.audio_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await env.AUDIO_BUCKET.put(audioKey, bytes, {
          httpMetadata: { contentType: audioType },
          customMetadata: { userId, entryId: id }
        });
      }
    } catch (err) {
      console.warn("R2 voice recording upload note:", err);
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = body.created_at || body.createdAt || now;
  const updatedAt = now;
  await env.DB.prepare(
    `INSERT INTO diary_entries (
      id, user_id, title, entry_date, transcript, language, mood,
      illustration_prompt, image_key, audio_key, audio_duration, audio_type,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      entry_date = excluded.entry_date,
      transcript = excluded.transcript,
      language = excluded.language,
      mood = excluded.mood,
      illustration_prompt = excluded.illustration_prompt,
      image_key = excluded.image_key,
      audio_key = coalesce(excluded.audio_key, diary_entries.audio_key),
      audio_duration = coalesce(excluded.audio_duration, diary_entries.audio_duration),
      audio_type = coalesce(excluded.audio_type, diary_entries.audio_type),
      updated_at = excluded.updated_at`
  ).bind(
    id,
    userId,
    title,
    entryDate,
    transcript,
    language,
    mood,
    illustrationPrompt,
    imageKey,
    audioKey,
    audioDuration,
    audioType,
    createdAt,
    updatedAt
  ).run();
  return json({
    ok: true,
    id,
    audio_key: audioKey,
    user_id: userId,
    updated_at: updatedAt
  });
}
__name(handleSaveEntry, "handleSaveEntry");
async function handleListEntries(request, env) {
  if (!env.DB) throw httpError(500, 'D1 database binding "DB" is not configured');
  const userId = getUserId(request);
  const { results } = await env.DB.prepare(
    "SELECT * FROM diary_entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC"
  ).bind(userId).all();
  return json({ entries: results || [] });
}
__name(handleListEntries, "handleListEntries");
async function handleGetEntry(request, env, id) {
  if (!env.DB) throw httpError(500, 'D1 database binding "DB" is not configured');
  const userId = getUserId(request);
  const entry = await env.DB.prepare(
    "SELECT * FROM diary_entries WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!entry) throw httpError(404, "Entry not found");
  return json({ entry });
}
__name(handleGetEntry, "handleGetEntry");
async function handleDeleteEntry(request, env, id) {
  if (!env.DB) throw httpError(500, 'D1 database binding "DB" is not configured');
  const userId = getUserId(request);
  const existing = await env.DB.prepare(
    "SELECT audio_key FROM diary_entries WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) throw httpError(404, "Entry not found");
  if (existing.audio_key && env.AUDIO_BUCKET) {
    try {
      await env.AUDIO_BUCKET.delete(existing.audio_key);
    } catch (err) {
      console.warn("R2 audio delete note:", err);
    }
  }
  await env.DB.prepare("DELETE FROM diary_entries WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return json({ ok: true, deleted: id });
}
__name(handleDeleteEntry, "handleDeleteEntry");
async function handleGetAudio(request, env, audioKey) {
  if (!env.AUDIO_BUCKET) {
    throw httpError(501, 'R2 audio storage binding "AUDIO_BUCKET" is not configured');
  }
  const userId = getUserId(request);
  if (env.DB) {
    const record = await env.DB.prepare(
      "SELECT user_id, audio_type FROM diary_entries WHERE audio_key = ?"
    ).bind(audioKey).first();
    if (record && record.user_id !== userId) {
      throw httpError(403, "Forbidden: You do not have permission to access this voice recording.");
    }
  }
  const object = await env.AUDIO_BUCKET.get(audioKey);
  if (!object) throw httpError(404, "Voice recording not found in storage");
  const headers = new Headers({
    ...CORS,
    "Content-Type": object.httpMetadata?.contentType || "audio/webm",
    "Cache-Control": "private, max-age=3600",
    ETag: object.httpEtag
  });
  return new Response(object.body, { headers });
}
__name(handleGetAudio, "handleGetAudio");
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
      if (request.method === "POST" && pathname === "/api/prompt") {
        return await handlePrompt(request, env);
      }
      if (request.method === "POST" && pathname === "/api/image") {
        return await handleImage(request, env);
      }
      if (request.method === "POST" && pathname === "/api/entries") {
        return await handleSaveEntry(request, env);
      }
      if (request.method === "GET" && pathname === "/api/entries") {
        return await handleListEntries(request, env);
      }
      const entryMatch = pathname.match(/^\/api\/entries\/([^/]+)$/);
      if (entryMatch) {
        const id = decodeURIComponent(entryMatch[1]);
        if (request.method === "GET") {
          return await handleGetEntry(request, env, id);
        }
        if (request.method === "DELETE") {
          return await handleDeleteEntry(request, env, id);
        }
      }
      const audioMatch = pathname.match(/^\/api\/audio\/(.+)$/);
      if (audioMatch && request.method === "GET") {
        const audioKey = decodeURIComponent(audioMatch[1]);
        return await handleGetAudio(request, env, audioKey);
      }
      return json({ error: "Endpoint not found" }, 404);
    } catch (err) {
      return json({ error: err.message || "Server error" }, err.status || 500);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-9pvfPC/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-9pvfPC/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
