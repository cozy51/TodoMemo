const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("search-normalize.js", "utf8"), context);

function run(code) {
  return vm.runInContext(code, context);
}

function matches(query, target) {
  return run(`searchTextsMatchQuery([${JSON.stringify(target)}], parseSearchQuery(${JSON.stringify(query)}))`);
}

// --- 正規化 -----------------------------------------------------------------
const normalizationCases = [
  ["HU-300", "hu300"],
  ["HU 300", "hu300"],
  ["HU_300", "hu300"],
  ["ＨＵ３００", "hu300"],
  ["ＨＵ－３００", "hu300"],
  ["SRC350-M2", "src350m2"],
  ["SRC350 M2", "src350m2"],
  ["センサー確認", "センサー確認"],
  ["ｾﾝｻｰ", "センサー"],
  ["ﾊﾟﾈﾙ", "パネル"],
  ["コーヒー", "コーヒー"]
];
normalizationCases.forEach(([input, expected]) => {
  const actual = run(`normalizeSearchText(${JSON.stringify(input)})`);
  if (actual !== expected) {
    throw new Error(`normalizeSearchText(${input}) expected ${expected}, received ${actual}`);
  }
});

// --- 依頼のテスト項目 + 追加ケース -------------------------------------------
const matchCases = [
  ["HU300", "HU-300", true],
  ["hu300", "HU300", true],
  ["HU 300", "HU_300", true],
  ["HU300", "ＨＵ－３００", true],
  ["SRC350M2", "SRC350-M2", true],
  ["SRC350M2", "SRC350 M2", true],
  ["SRC350-M2", "SRC350M2", true],
  ["HU300 センサー", "センサー確認 HU-300", true],
  ["センサー HU300", "センサー確認 HU-300", true],
  ["HU300", "HU330", false],
  ["HU300", "HU3000", false],
  ["HU300", "HU-3000", false],
  ["HU300", "XHU300の点検", true],
  ["HU300", "HU300 3000台", true],
  ["SRC350M2", "SRC350-M20", false],
  ["HU300 センサー", "HU-300 確認", false],
  ["センサー", "センサ", false],
  ["センサー", "ｾﾝｻｰ交換", true],
  ["202", "2026-11-02", true],
  ["確認", "センサー確認 HU-300", true]
];
matchCases.forEach(([query, target, expected]) => {
  const actual = matches(query, target);
  if (actual !== expected) {
    throw new Error(`"${query}" vs "${target}": expected ${expected ? "hit" : "no hit"}`);
  }
});

// Keywords may be spread across different fields of one task.
if (!run(`searchTextsMatchQuery(["HU-300 交換", "センサー不良"], parseSearchQuery("HU300 センサー"))`)) {
  throw new Error("Keywords split across fields must still match");
}

// --- 関連度 -----------------------------------------------------------------
const tierCases = [
  ["HU-300", "HU-300", 0],
  ["hu-300", "HU-300", 0],
  ["HU300", "HU-300", 1],
  ["HU-300", "HU-300 点検", 2],
  ["HU300", "HU-300 点検", 3]
];
tierCases.forEach(([query, target, expected]) => {
  const actual = run(`getSearchMatchTier([${JSON.stringify(target)}], parseSearchQuery(${JSON.stringify(query)}))`);
  if (actual !== expected) {
    throw new Error(`Tier for "${query}" vs "${target}" expected ${expected}, received ${actual}`);
  }
});

// --- ハイライト範囲は元の文字列上の位置 ---------------------------------------
const highlight = JSON.parse(run(`JSON.stringify(getSearchHighlightRanges("確認 ＨＵ－３００ とセンサー", parseSearchQuery("hu300 センサー")))`));
if (JSON.stringify(highlight) !== JSON.stringify([[3, 9], [11, 15]])) {
  throw new Error(`Unexpected highlight ranges ${JSON.stringify(highlight)}`);
}

// --- organizer.js の検索処理 (検索対象フィールド・並び順) ------------------------
const organizerSource = fs.readFileSync("organizer.js", "utf8");
const start = organizerSource.indexOf("function getTaskStatusMeta(task)");
const end = organizerSource.indexOf("function navigateToSearchResult(task)");
if (start < 0 || end < 0) throw new Error("Search functions not found in organizer.js");

const tasks = [
  { id: "a", caseNumber: "T-0001", title: "HU-3000 点検", content: "", tagIds: [], links: [] },
  { id: "b", caseNumber: "T-0002", title: "定期点検", content: "HU-300 のセンサー交換", tagIds: [], links: [] },
  { id: "c", caseNumber: "T-0003", title: "HU-300", content: "", tagIds: [], links: [] },
  { id: "d", caseNumber: "T-0004", title: "HU300", content: "", tagIds: [], links: [] },
  { id: "e", caseNumber: "T-0005", title: "ＨＵ－３００ 修理", content: "", tagIds: [], links: [] },
  { id: "f", caseNumber: "T-0006", title: "資料", content: "", tagIds: ["t1"], links: ["https://example.com/HU_300"] },
  { id: "g", caseNumber: "T-0007", title: "別件", content: "", tagIds: [], links: [], projectId: "p1" }
];
const organizerContext = {
  tasks,
  tags: [{ id: "t1", name: "センサー" }],
  getProjectForTask: (task) => (task.projectId ? { caseNumber: "P-01", name: "HU 300 更新" } : null),
  SEARCH_MIN_LENGTH: 2,
  SEARCH_SNIPPET_RADIUS: 42
};
vm.createContext(organizerContext);
vm.runInContext(fs.readFileSync("search-normalize.js", "utf8"), organizerContext);
vm.runInContext(organizerSource.slice(start, end), organizerContext);

const ids = (query) => vm.runInContext(`searchTasks(${JSON.stringify(query)}).map((r) => r.task.id).join(",")`, organizerContext);

// 完全一致 (d) → 正規化後の一致 (c) → タイトル部分一致 (e) → その他の部分一致
const ranked = ids("HU300");
if (ranked !== "d,c,e,g,f,b") {
  throw new Error(`Unexpected ranking for HU300: ${ranked}`);
}
if (ids("HU300 センサー") !== "f,b") {
  throw new Error(`Unexpected multi-keyword result: ${ids("HU300 センサー")}`);
}
if (ids("") !== "" || ids("H") !== "") {
  throw new Error("Empty / too short query must keep returning no search results");
}
if (ids("T-0003") !== "c" || ids("t0003") !== "c") {
  throw new Error("Task番号 must stay searchable with and without the hyphen");
}
const snippet = vm.runInContext(`buildSnippetWindow("定期点検として HU-300 のセンサー交換", parseSearchQuery("hu300"))`, organizerContext);
if (!snippet.includes("HU-300")) throw new Error("Snippet must contain the normalized match");

// Data is never rewritten by searching.
if (tasks[2].title !== "HU-300" || tasks[4].title !== "ＨＵ－３００ 修理") {
  throw new Error("Search must not modify task data");
}

// --- 性能 -----------------------------------------------------------------
const bigTasks = Array.from({ length: 5000 }, (_, i) => ({
  id: `x${i}`,
  caseNumber: `T-${String(i).padStart(5, "0")}`,
  title: `タスク${i} HU-${i % 1000} 点検`,
  content: "センサー確認と部品交換。".repeat(20) + ` SRC${i}-M2`,
  tagIds: [],
  links: []
}));
organizerContext.tasks = bigTasks;
const startedAt = Date.now();
["H", "HU", "HU3", "HU30", "HU300", "HU300 ", "HU300 セ", "HU300 センサー"].forEach((query) => ids(query));
const elapsed = Date.now() - startedAt;
if (elapsed > 3000) throw new Error(`Search over 5000 tasks too slow: ${elapsed}ms`);

console.log(`Search-normalize tests: OK (5000 tasks x 8 keystrokes: ${elapsed}ms)`);
