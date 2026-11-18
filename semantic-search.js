// AI検索（意味による類似検索）。
// タスクごとに「タイトル・内容・Project・タグ」をまとめた検索用テキストを Embedding（ベクトル）にして
// このPCのブラウザー（IndexedDB）に保存しておき、検索時は検索文だけをベクトルにして
// 保存済みのベクトルとのコサイン類似度で並べる。
// ベクトルは検索用テキストのハッシュと一緒に保存し、内容が変わったタスク・追加したタスクだけを再計算する。
// Embedding はサーバーの /api/embed（Gemini）経由で計算し、APIキーはブラウザーに置かない。

const SEMANTIC_SEARCH_DIMENSIONS = 768;
const SEMANTIC_SEARCH_BATCH = 100;
const SEMANTIC_SEARCH_MAX_TEXT = 2000;
/** 最も近いタスクとの差がこの範囲内のタスクを結果に含める（少なくとも MIN 件・最大 LIMIT 件） */
const SEMANTIC_SEARCH_WINDOW = 0.12;
const SEMANTIC_SEARCH_MIN = 5;
const SEMANTIC_SEARCH_LIMIT = 30;
/** 最低件数を満たすためでも、最上位からこの差より遠いタスクは出さない（無関係なタスクを並べない） */
const SEMANTIC_SEARCH_MAX_GAP = 0.2;
/** 意味の近さを重視し、キーワードが一致したタスクを少し加点する */
const SEMANTIC_WEIGHT = 0.85;
const SEMANTIC_KEYWORD_WEIGHT = 0.15;

class SemanticSearchError extends Error {
  constructor(message, code = "") {
    super(message);
    this.code = code;
  }
}

/** 文字列の簡易ハッシュ（cyrb53）。検索用テキストが変わったかの判定に使う */
function semanticHash(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** ベクトルを長さ1に正規化して int8 に量子化し、base64 にする（保存容量を1/4にする） */
function quantizeVector(vector) {
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  let binary = "";
  for (const value of vector) {
    const byte = Math.max(-127, Math.min(127, Math.round(value / norm * 127))) & 0xff;
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** 量子化したベクトルを、長さ1に正規化した Float32Array に戻す（内積＝コサイン類似度になる） */
function dequantizeVector(text) {
  const binary = atob(text);
  const vector = new Float32Array(binary.length);
  let norm = 0;
  for (let i = 0; i < binary.length; i += 1) {
    const value = ((binary.charCodeAt(i) << 24) >> 24) / 127;
    vector[i] = value;
    norm += value * value;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  return vector;
}

/** 長さ1のベクトルどうしの内積（＝コサイン類似度） */
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

/** 検索用テキスト。空なら対象外（null） */
function buildSemanticText({ title = "", content = "", project = "", tags = "" }) {
  const parts = [
    String(title).trim(),
    project ? `Project: ${String(project).trim()}` : "",
    tags ? `タグ: ${String(tags).trim()}` : "",
    String(content).trim()
  ].filter(Boolean);
  if (!parts.length) return null;
  return parts.join("\n").slice(0, SEMANTIC_SEARCH_MAX_TEXT);
}

/** 1文字だけの検索は意味検索に向かないので対象外にする */
function wantsSemanticSearch(query) {
  return String(query || "").trim().length >= 2;
}

/**
 * 結果の順位づけ。items: [{ id, semantic?: number, keyword: boolean }]
 * 意味の近いタスク（最上位から WINDOW 以内、少なくとも MIN 件・最大 LIMIT 件。ただし MAX_GAP より遠いものは除く）と、
 * キーワードが一致したタスクを残し、score の高い順に並べる。
 */
function rankSemanticResults(items) {
  const values = items
    .filter((item) => typeof item.semantic === "number")
    .map((item) => item.semantic)
    .sort((a, b) => b - a);
  if (!values.length) {
    return items.filter((item) => item.keyword).map((item) => ({ ...item, score: SEMANTIC_KEYWORD_WEIGHT }));
  }
  const nth = (n) => values[Math.min(n, values.length) - 1];
  const cutoff = Math.max(
    Math.min(Math.max(values[0] - SEMANTIC_SEARCH_WINDOW, nth(SEMANTIC_SEARCH_LIMIT)), nth(SEMANTIC_SEARCH_MIN)),
    values[0] - SEMANTIC_SEARCH_MAX_GAP
  );
  return items
    .filter((item) => item.keyword || (typeof item.semantic === "number" && item.semantic >= cutoff))
    .map((item) => ({
      ...item,
      // ベクトルがまだ無いタスクは、キーワードの一致だけで意味検索の下限あたりに置く
      score: SEMANTIC_WEIGHT * (typeof item.semantic === "number" ? item.semantic : cutoff)
        + SEMANTIC_KEYWORD_WEIGHT * (item.keyword ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * AI検索のエンジン。ブラウザーの外（fetch・保存先・トークン）は差し替えられるようにして、テストでも動かせる。
 *   fetchImpl     … fetch
 *   getAuthToken  … クラウド同期のアクセストークン（未ログインなら null）
 *   loadIndex / saveIndex … 検索用ベクトルの読み書き
 *   wait          … 再試行までの待機
 */
function createSemanticSearchEngine({
  fetchImpl,
  getAuthToken = async () => null,
  loadIndex = async () => null,
  saveIndex = async () => {},
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  const emptyIndex = () => ({ version: 1, model: "", entries: {} });
  let index = null;
  let queue = Promise.resolve();
  const queryCache = new Map();
  const vectorCache = new Map();

  async function fetchEmbeddings(texts, task) {
    for (let attempt = 0; ; attempt += 1) {
      const token = await getAuthToken().catch(() => null);
      let response;
      try {
        response = await fetchImpl("/api/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ texts, task, dimensions: SEMANTIC_SEARCH_DIMENSIONS })
        });
      } catch {
        throw new SemanticSearchError("AI検索のサーバーに接続できませんでした。ネットワークを確認してください。", "network");
      }
      const data = await response.json().catch(() => null);
      if (response.ok && data?.model && Array.isArray(data.vectors) && data.vectors.length === texts.length) {
        return { model: data.model, vectors: data.vectors };
      }
      if (response.status === 429 && attempt < 2) {
        await wait(4000 * 2 ** attempt);
        continue;
      }
      if (response.status === 404 && !data) {
        throw new SemanticSearchError("AI検索のサーバー（/api/embed）が見つかりません。Vercelへデプロイするか、vercel dev で起動してください。", "not_found");
      }
      throw new SemanticSearchError(data?.error || `AI検索のサーバーの呼び出しに失敗しました（${response.status}）`, data?.code || "");
    }
  }

  async function currentIndex() {
    if (!index) {
      const saved = await loadIndex().catch(() => null);
      index = saved?.version === 1 && saved.entries ? saved : emptyIndex();
    }
    return index;
  }

  /**
   * 検索用ベクトルを最新にする。docs: [{ id, text }]
   * 検索用テキストが変わった・追加されたタスクだけ Embedding API に送り、無くなったタスクのベクトルは消す。
   */
  async function updateNow(docs, onProgress) {
    const texts = new Map();
    const hashes = new Map();
    docs.forEach(({ id, text }) => {
      if (!text) return;
      texts.set(id, text);
      hashes.set(id, semanticHash(text));
    });
    let next = { ...(await currentIndex()) };
    next.entries = { ...next.entries };
    let changed = false;
    Object.keys(next.entries).forEach((id) => {
      if (!hashes.has(id)) {
        delete next.entries[id];
        changed = true;
      }
    });

    let missing = [...hashes.keys()].filter((id) => next.entries[id]?.h !== hashes.get(id));
    let error = null;
    for (let i = 0; i < missing.length; i += SEMANTIC_SEARCH_BATCH) {
      onProgress?.({ done: i, total: missing.length });
      const ids = missing.slice(i, i + SEMANTIC_SEARCH_BATCH);
      let result;
      try {
        result = await fetchEmbeddings(ids.map((id) => texts.get(id)), "document");
      } catch (caught) {
        error = caught instanceof SemanticSearchError ? caught : new SemanticSearchError(String(caught));
        break;
      }
      if (next.model && next.model !== result.model) {
        // モデルが変わったら以前のベクトルとは比べられないので、全件を計算し直す
        next = { ...emptyIndex(), model: result.model };
        missing = [...hashes.keys()];
        i = -SEMANTIC_SEARCH_BATCH;
        changed = true;
        continue;
      }
      next.model = result.model;
      ids.forEach((id, j) => {
        next.entries[id] = { h: hashes.get(id), e: quantizeVector(result.vectors[j]) };
      });
      changed = true;
      // 途中で止まっても計算済みの分は使えるよう、バッチごとに保存する
      index = next;
      await saveIndex(next).catch(() => {});
    }
    if (changed) {
      index = next;
      await saveIndex(next).catch(() => {});
    }
    onProgress?.({ done: missing.length, total: missing.length });
    return { index, error };
  }

  function updateIndex(docs, onProgress) {
    const result = queue.then(() => updateNow(docs, onProgress));
    queue = result.catch(() => undefined);
    return result;
  }

  /** 検索文をベクトルにする（同じ検索文は覚えておき、APIを呼ばない） */
  async function embedQuery(text) {
    const key = String(text).trim();
    const cached = queryCache.get(key);
    if (cached) return cached;
    const { model, vectors } = await fetchEmbeddings([key], "query");
    const result = { model, vector: dequantizeVector(quantizeVector(vectors[0])) };
    queryCache.set(key, result);
    if (queryCache.size > 100) queryCache.delete(queryCache.keys().next().value);
    return result;
  }

  /** 保存済みのベクトルと検索文のコサイン類似度。ベクトルの無いタスクは含まない */
  function scores(currentIndexValue, ids, queryVector) {
    const result = new Map();
    ids.forEach((id) => {
      const entry = currentIndexValue.entries[id];
      if (!entry?.e) return;
      let cached = vectorCache.get(id);
      if (!cached || cached.h !== entry.h) {
        cached = { h: entry.h, v: dequantizeVector(entry.e) };
        vectorCache.set(id, cached);
      }
      if (cached.v.length === queryVector.length) result.set(id, dotProduct(cached.v, queryVector));
    });
    return result;
  }

  /** 検索用ベクトルを全件計算し直す */
  async function rebuild(docs, onProgress) {
    await queue;
    index = emptyIndex();
    vectorCache.clear();
    queryCache.clear();
    return updateIndex(docs, onProgress);
  }

  return { updateIndex, embedQuery, scores, rebuild, currentIndex };
}

// ---- ブラウザー内の保存（IndexedDB。localStorageより大きなデータを置ける） ----

const SEMANTIC_DB_NAME = "todomemo-semantic";
const SEMANTIC_DB_STORE = "kv";
const SEMANTIC_DB_KEY = "task-index-v1";

function openSemanticDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SEMANTIC_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SEMANTIC_DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadSemanticIndexFromBrowser() {
  try {
    const db = await openSemanticDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(SEMANTIC_DB_STORE).objectStore(SEMANTIC_DB_STORE).get(SEMANTIC_DB_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function saveSemanticIndexToBrowser(value) {
  try {
    const db = await openSemanticDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SEMANTIC_DB_STORE, "readwrite");
      tx.objectStore(SEMANTIC_DB_STORE).put(value, SEMANTIC_DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // 保存できなくても検索は続ける（次回また計算する）
  }
}

function createBrowserSemanticSearchEngine() {
  return createSemanticSearchEngine({
    fetchImpl: (...args) => fetch(...args),
    getAuthToken: async () => (await window.todoMemoCloudSync?.getAuthToken?.()) || null,
    loadIndex: loadSemanticIndexFromBrowser,
    saveIndex: saveSemanticIndexToBrowser
  });
}
