const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { btoa, atob, setTimeout, Float32Array, Promise, Map, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync("semantic-search.js", "utf8"), context);
// vm の中で作られた配列・オブジェクトは比較できるように、こちら側の値に直す
const run = (code) => { const value = vm.runInContext(code, context); return Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : value; };

// --- ベクトルの量子化 --------------------------------------------------------
{
  const vector = [3, 4, 0, -2];
  const restored = Array.from(run(`dequantizeVector(quantizeVector(${JSON.stringify(vector)}))`));
  const norm = Math.hypot(...vector);
  restored.forEach((value, i) => assert.ok(Math.abs(value - vector[i] / norm) < 0.02, `quantize ${i}`));
  const self = run(`(() => { const v = dequantizeVector(quantizeVector([1, 2, 3])); return dotProduct(v, v); })()`);
  assert.ok(Math.abs(self - 1) < 1e-5, "正規化したベクトルの内積は1");
}

// --- ハッシュと検索用テキスト ------------------------------------------------
assert.strictEqual(run(`semanticHash("abc")`), run(`semanticHash("abc")`));
assert.notStrictEqual(run(`semanticHash("abc")`), run(`semanticHash("abd")`));
assert.strictEqual(run(`buildSemanticText({ title: " ", content: "" })`), null);
assert.strictEqual(
  run(`buildSemanticText({ title: "HU300 ベルト", project: "HU300 全般", tags: "設計", content: "形状を検討" })`),
  "HU300 ベルト\nProject: HU300 全般\nタグ: 設計\n形状を検討"
);
assert.strictEqual(run(`wantsSemanticSearch("a")`), false);
assert.strictEqual(run(`wantsSemanticSearch("固定")`), true);

// --- 順位づけ ----------------------------------------------------------------
{
  const items = [
    { id: "a", semantic: 0.80, keyword: false },
    { id: "b", semantic: 0.75, keyword: false },
    { id: "c", semantic: 0.30, keyword: false },
    { id: "d", semantic: 0.20, keyword: true },
    { id: "e", keyword: true },
    { id: "f", keyword: false }
  ];
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, semantic: 0.1 - i * 0.001, keyword: false }));
  const ranked = run(`rankSemanticResults(${JSON.stringify([...items, ...many])})`).map((item) => item.id);
  assert.strictEqual(ranked[0], "a", "意味の最も近いタスクが先頭");
  assert.ok(ranked.indexOf("b") < ranked.indexOf("d"), "意味の近い順");
  assert.ok(ranked.includes("d") && ranked.includes("e"), "キーワードが一致したタスクは残る");
  assert.ok(!ranked.includes("f"), "ベクトルも一致も無いタスクは出ない");
  assert.ok(!ranked.includes("x9"), "遠いタスクは出ない");
  // 最低件数（5件）を満たすためでも、最上位から0.2より遠いタスクは出さない
  assert.ok(!ranked.includes("c"), "遠すぎるタスクで件数を埋めない");
  const close = run(`rankSemanticResults(${JSON.stringify([0.88, 0.7, 0.72, 0.71, 0.69, 0.5].map((semantic, i) => ({ id: `m${i}`, semantic, keyword: false })))})`).map((item) => item.id);
  assert.deepStrictEqual(close, ["m0", "m2", "m3", "m1", "m4"], "1件だけ飛び抜けて近くても、近いものは最低件数まで出す");
  assert.deepStrictEqual(run(`rankSemanticResults([{ id: "k", keyword: true }, { id: "n", keyword: false }])`).map((i) => i.id), ["k"]);
}

// --- エンジン（APIの呼び出しは変わったタスクだけ） ---------------------------
async function testEngine() {
  const calls = [];
  let saved = null;
  let model = "gemini:m1:768";
  const fakeVector = (text) => {
    const v = new Array(768).fill(0);
    for (const ch of text) v[ch.charCodeAt(0) % 768] += 1;
    return v;
  };
  context.fakeFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, auth: init.headers.Authorization });
    return { ok: true, status: 200, json: async () => ({ model, vectors: body.texts.map(fakeVector) }) };
  };
  context.fakeSave = async (value) => { saved = JSON.parse(JSON.stringify(value)); };
  const engine = run(`createSemanticSearchEngine({ fetchImpl: fakeFetch, getAuthToken: async () => "tok", saveIndex: fakeSave })`);

  const docs = [{ id: "1", text: "部品の固定" }, { id: "2", text: "会議資料の準備" }, { id: "3", text: null }];
  let { index, error } = await engine.updateIndex(docs);
  assert.strictEqual(error, null);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0].body.texts, ["部品の固定", "会議資料の準備"]);
  assert.strictEqual(calls[0].body.task, "document");
  assert.strictEqual(calls[0].auth, "Bearer tok");
  assert.deepStrictEqual(Object.keys(saved.entries).sort(), ["1", "2"]);

  // 変わっていなければAPIを呼ばない
  await engine.updateIndex(docs);
  assert.strictEqual(calls.length, 1, "変更なしなら再計算しない");

  // 1件だけ変更・1件削除
  ({ index } = await engine.updateIndex([{ id: "1", text: "部品の固定方法" }]));
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[1].body.texts, ["部品の固定方法"]);
  assert.deepStrictEqual(Object.keys(index.entries), ["1"]);

  // 検索文は query で送り、同じ検索文は覚えておく
  const q = await engine.embedQuery("部品の固定方法");
  await engine.embedQuery("部品の固定方法 ");
  assert.strictEqual(calls.length, 3);
  assert.strictEqual(calls[2].body.task, "query");
  const scores = engine.scores(index, ["1", "2"], q.vector);
  assert.ok(scores.get("1") > 0.99);
  assert.ok(!scores.has("2"));

  // モデルが変わったら全件を作り直す
  model = "gemini:m2:768";
  ({ index } = await engine.updateIndex([{ id: "1", text: "部品の固定方法" }, { id: "4", text: "新しいタスク" }]));
  assert.strictEqual(index.model, "gemini:m2:768");
  assert.deepStrictEqual(calls[calls.length - 1].body.texts, ["部品の固定方法", "新しいタスク"]);

  // エラーはメッセージとコードを返す
  context.errorFetch = async () => ({ ok: false, status: 401, json: async () => ({ error: "ログインしてください", code: "unauthorized" }) });
  const failing = run(`createSemanticSearchEngine({ fetchImpl: errorFetch })`);
  const failed = await failing.updateIndex([{ id: "1", text: "x" }]);
  assert.strictEqual(failed.error.code, "unauthorized");
  assert.strictEqual(failed.index.model, "");
  await assert.rejects(failing.embedQuery("x"), (e) => e.code === "unauthorized");
}

// --- サーバー（api/embed.js） --------------------------------------------------
async function testApi() {
  const handler = require("../api/embed.js");
  const call = async (body, { method = "POST", headers = {} } = {}) => {
    const out = { status: 0, body: null, headers: {} };
    const response = {
      setHeader: (k, v) => { out.headers[k] = v; },
      status(code) { out.status = code; return this; },
      json(value) { out.body = value; return this; }
    };
    await handler({ method, headers, body }, response);
    return out;
  };
  const originalFetch = global.fetch;
  const env = { ...process.env };
  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    assert.strictEqual((await call({ texts: ["a"] })).status, 503);
    process.env.GEMINI_API_KEY = "key";
    assert.strictEqual((await call({}, { method: "GET" })).status, 405);
    assert.strictEqual((await call({ texts: [] })).status, 400);
    assert.strictEqual((await call({ texts: ["a"], task: "clustering" })).status, 400);

    const upstream = [];
    global.fetch = async (url, init) => {
      upstream.push({ url, init });
      if (String(url).includes("/auth/v1/user")) {
        return { ok: init.headers.Authorization === "Bearer good", json: async () => ({ id: "u1" }) };
      }
      const body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ embeddings: body.requests.map(() => ({ values: [1, 0] })) }) };
    };
    const ok = await call({ texts: ["a", "b"], task: "query" });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.model, "gemini:gemini-embedding-001:768");
    assert.strictEqual(ok.body.vectors.length, 2);
    const sent = JSON.parse(upstream[0].init.body);
    assert.strictEqual(sent.requests[0].taskType, "RETRIEVAL_QUERY");
    assert.strictEqual(upstream[0].init.headers["x-goog-api-key"], "key");

    // Supabase が設定されていれば、ログイン中のトークンだけを受け付ける
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon";
    assert.strictEqual((await call({ texts: ["a"] })).status, 401);
    assert.strictEqual((await call({ texts: ["a"] }, { headers: { authorization: "Bearer bad" } })).status, 401);
    assert.strictEqual((await call({ texts: ["a"] }, { headers: { authorization: "Bearer good" } })).status, 200);

    global.fetch = async () => ({ ok: false, status: 429, text: async () => "quota" });
    const limited = await call({ texts: ["a"] }, { headers: { authorization: "Bearer good" } });
    assert.strictEqual(limited.status, 429);
    assert.strictEqual(limited.body.code, "rate_limited");
  } finally {
    global.fetch = originalFetch;
    process.env = env;
  }
}

(async () => {
  const log = console.error;
  console.error = () => {};
  try {
    await testEngine();
    await testApi();
  } finally {
    console.error = log;
  }
  console.log("semantic search tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
