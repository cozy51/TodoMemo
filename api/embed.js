// AI検索（意味による類似検索）用の Embedding API（Vercel Function）。
//   task       … document（検索されるタスク）/ query（検索文）
//   dimensions … 768（既定）または 256
// APIキーはサーバーの環境変数 GEMINI_API_KEY だけで扱い、ブラウザーには渡さない。
// モデルを変えるときだけ EMBEDDING_MODEL を設定する（既定: gemini-embedding-001）。
// Supabase が設定されているときは、このアプリでログインしたユーザーのトークンだけを受け付ける。

const DIMENSIONS = [768, 256];
const GEMINI_TASK = { document: "RETRIEVAL_DOCUMENT", query: "RETRIEVAL_QUERY" };
const MAX_TEXTS = 100;
const MAX_CHARS = 2000;
const DEFAULT_MODEL = "gemini-embedding-001";

class UpstreamError extends Error {
  constructor(status, detail) {
    super(String(detail || "").slice(0, 300));
    this.status = status;
  }
}

function reply(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.status(status).json(body);
}

// 確認済みのトークン（同じインスタンスで何度も Supabase に問い合わせないため）
const verified = new Map();
const VERIFIED_TTL_MS = 5 * 60 * 1000;

/** Supabase のアクセストークンが、このアプリのプロジェクトで有効なユーザーのものか確かめる */
async function authorized(request) {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anonKey = (process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !anonKey) return true; // クラウド同期を使わない構成では確認しない
  const header = request.headers.authorization || "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  if ((verified.get(token) || 0) > Date.now()) return true;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return false;
    const user = await res.json();
    if (!user?.id) return false;
  } catch {
    return false;
  }
  if (verified.size > 500) verified.clear();
  verified.set(token, Date.now() + VERIFIED_TTL_MS);
  return true;
}

async function embedGemini(key, model, texts, task, dimensions) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType: GEMINI_TASK[task],
          outputDimensionality: dimensions
        }))
      }),
      signal: AbortSignal.timeout(60000)
    }
  );
  if (!res.ok) throw new UpstreamError(res.status, await res.text());
  const data = await res.json();
  return data.embeddings.map((entry) => entry.values);
}

/** 外部AI APIの失敗を、画面に出せるメッセージにする */
function upstreamFailure(response, error) {
  const status = error instanceof UpstreamError ? error.status : 0;
  console.error("Embedding API failed", status, error instanceof Error ? error.message : error);
  if (status === 402) {
    return reply(response, 402, {
      error: "Gemini API の残高（前払いクレジット）が足りないため、AI検索を使えませんでした。Google AI Studio の「Billing」でクレジットを追加してください。",
      code: "billing"
    });
  }
  if (status === 429) {
    return reply(response, 429, { error: "Embedding APIの利用上限に達しました。少し待ってから再試行してください。", code: "rate_limited" });
  }
  return reply(response, 502, {
    error: `Embedding APIの呼び出しに失敗しました（${status || "通信エラー"}）`,
    ...((!status || status >= 500) && { code: "temporary" })
  });
}

function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return reply(response, 405, { error: "POSTで呼び出してください" });
  }
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    return reply(response, 503, {
      error: "AI検索のAPIキーが未設定です。Vercelの環境変数 GEMINI_API_KEY を設定して再デプロイしてください。",
      code: "not_configured"
    });
  }
  if (!await authorized(request)) {
    return reply(response, 401, { error: "AI検索を使うには、クラウド同期にログインしてください。", code: "unauthorized" });
  }

  const body = readBody(request);
  const { texts } = body;
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS
    || !texts.every((text) => typeof text === "string" && text.trim())) {
    return reply(response, 400, { error: `texts には空でない文字列を1〜${MAX_TEXTS}件指定してください` });
  }
  const task = body.task ?? "document";
  if (!Object.hasOwn(GEMINI_TASK, task)) return reply(response, 400, { error: "task は document・query のいずれかです" });
  const dimensions = Number(body.dimensions ?? DIMENSIONS[0]);
  if (!DIMENSIONS.includes(dimensions)) return reply(response, 400, { error: `dimensions は ${DIMENSIONS.join("・")} のいずれかです` });

  const model = (process.env.EMBEDDING_MODEL || "").trim() || DEFAULT_MODEL;
  try {
    const input = texts.map((text) => text.slice(0, MAX_CHARS));
    const vectors = await embedGemini(key, model, input, task, dimensions);
    if (!Array.isArray(vectors) || vectors.length !== input.length) throw new UpstreamError(0, "unexpected response");
    return reply(response, 200, { model: `gemini:${model}:${dimensions}`, vectors });
  } catch (error) {
    return upstreamFailure(response, error);
  }
};
