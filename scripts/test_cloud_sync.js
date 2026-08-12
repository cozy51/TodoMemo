const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = new Map();
const context = {
  JSON, Map, Set, String, Math, Number, Date, Array, Object, RegExp, Boolean,
  Intl, console, Promise,
  crypto: { randomUUID: () => `id-${store.size}-${Math.random().toString(36).slice(2)}` },
  navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0" },
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "storage.js"), "utf8"), context);

const {
  decideSyncAction, assessDatasetShrink, createDatasetFingerprint, normalizeDataset,
  loadTodoMemoSyncState, saveTodoMemoSyncState, countDatasetRecords, isDatasetEmpty,
  validateBackup, describeTodoMemoDevice, getTodoMemoDeviceId, selectExpiredHistory
} = context;

function check(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

// --- decideSyncAction ------------------------------------------------------
// The single rule that keeps an old copy from replacing newer work.

const base = {
  remoteExists: true,
  remoteLegacy: false,
  remoteRevision: 5,
  remoteFingerprint: "remote",
  baseRevision: 5,
  baseFingerprint: "base",
  localFingerprint: "base",
  localEmpty: false
};

check(
  decideSyncAction({ ...base, remoteExists: false, localFingerprint: "local" }),
  "push",
  "First device seeds the cloud"
);
check(
  decideSyncAction({
    ...base, localEmpty: true, localFingerprint: "empty",
    baseRevision: 0, baseFingerprint: ""
  }),
  "pull",
  "A new browser, or one whose site data was cleared, adopts the cloud"
);
check(
  decideSyncAction({ ...base, localEmpty: true, localFingerprint: "empty" }),
  "push",
  "Emptying a browser that has synced before is an edit, not a fresh install"
);
check(
  decideSyncAction({
    ...base, remoteExists: false, localEmpty: true, localFingerprint: "empty",
    baseRevision: 0, baseFingerprint: ""
  }),
  "idle",
  "A new browser with no cloud document has nothing to do"
);
check(
  decideSyncAction({ ...base, remoteExists: false, localEmpty: true, localFingerprint: "empty" }),
  "push",
  "Emptying a synced browser is published even before the cloud has a document"
);
check(
  decideSyncAction({ ...base, remoteRevision: 9 }),
  "pull",
  "An untouched local copy follows a newer cloud revision"
);
check(
  decideSyncAction({ ...base, remoteRevision: 9, localFingerprint: "local" }),
  "conflict",
  "Unsynced local edits must never overwrite a newer cloud revision"
);
check(
  decideSyncAction({ ...base, localFingerprint: "local" }),
  "push",
  "Local edits on the current revision are published"
);
check(
  decideSyncAction({ ...base, baseRevision: 9 }),
  "conflict",
  "A cloud revision older than the local base is treated as suspicious"
);
check(
  decideSyncAction({ ...base, remoteRevision: 9, remoteFingerprint: "base" }),
  "adopt",
  "Identical content only needs its revision lineage aligned"
);
check(
  decideSyncAction({ ...base, remoteFingerprint: "base" }),
  "idle",
  "Identical content on the same revision needs no transfer"
);
check(
  decideSyncAction({ ...base, remoteLegacy: true, remoteRevision: 0, baseRevision: 0 }),
  "pull",
  "A pre-revision cloud file wins when nothing local is unsynced"
);
check(
  decideSyncAction({
    ...base, remoteLegacy: true, remoteRevision: 0, baseRevision: 0, localFingerprint: "local"
  }),
  "conflict",
  "A pre-revision cloud file cannot be ordered, so the user decides"
);
check(
  decideSyncAction({ ...base, localFingerprint: "base", remoteFingerprint: "other" }),
  "pull",
  "The cloud stays authoritative when it changed in place"
);
check(
  decideSyncAction({
    ...base, remoteLegacy: true, remoteRevision: 0, baseRevision: 0, baseFingerprint: "",
    remoteFingerprint: "same", localFingerprint: "same"
  }),
  "push",
  "Upgrading a matching pre-revision file numbers it now, so later edits are not conflicts"
);

// --- assessDatasetShrink ---------------------------------------------------
// The mis-click / wiped-profile guard.

const remoteDataset = {
  tasks: Array.from({ length: 10 }, (_, index) => ({ id: `t${index}` })),
  tags: [], parentCases: [], holidays: []
};

check(
  assessDatasetShrink(remoteDataset, { tasks: [], tags: [], parentCases: [], holidays: [] })?.reason,
  "empty",
  "An empty local copy must never silently clear the cloud"
);
check(
  assessDatasetShrink(remoteDataset, { tasks: remoteDataset.tasks.slice(0, 4) })?.reason,
  "shrink",
  "Losing more than half the records needs confirmation"
);
check(
  assessDatasetShrink(remoteDataset, { tasks: remoteDataset.tasks.slice(0, 9) }),
  null,
  "Deleting a single task is ordinary editing"
);
check(
  assessDatasetShrink(remoteDataset, { tasks: [...remoteDataset.tasks, { id: "new" }] }),
  null,
  "Adding records is never a loss"
);
check(
  assessDatasetShrink({ tasks: [], tags: [], parentCases: [], holidays: [] }, { tasks: [] }),
  null,
  "An empty cloud has nothing to protect"
);
check(
  assessDatasetShrink({ tasks: [{ id: "a" }, { id: "b" }] }, { tasks: [] })?.reason,
  "empty",
  "Even a tiny cloud copy is protected from a full wipe"
);

// --- fingerprints ----------------------------------------------------------

const sample = {
  tasks: [{ id: "a", title: "一つ目" }, { id: "b", title: "二つ目" }],
  tags: [{ id: "tag", name: "社内" }],
  parentCases: [],
  holidays: [{ date: "2026-01-01", type: "company" }]
};
const sameSample = JSON.parse(JSON.stringify(sample));
check(
  createDatasetFingerprint(sample),
  createDatasetFingerprint(sameSample),
  "Equal data must fingerprint equally"
);
if (createDatasetFingerprint(sample) === createDatasetFingerprint({
  ...sample,
  tasks: [{ id: "a", title: "一つ目" }, { id: "b", title: "二つ目！" }]
})) {
  throw new Error("An edited title must change the fingerprint");
}
if (createDatasetFingerprint(sample) === createDatasetFingerprint({
  ...sample,
  tasks: [sample.tasks[1], sample.tasks[0]]
})) {
  throw new Error("Reordering tasks changes the priority order and must be synced");
}
check(countDatasetRecords(sample), 4, "Record count spans every collection");
check(isDatasetEmpty({ tasks: [], tags: [], parentCases: [], holidays: [] }), true, "Empty dataset");

// --- normalizeDataset ------------------------------------------------------

const normalized = normalizeDataset({
  tasks: [
    { id: "task-1", title: "残る", tagIds: ["tag-1", "missing"], parentCaseId: "gone" },
    { id: "task-2", title: "", tagIds: [] }
  ],
  tags: [{ id: "tag-1", name: "社内" }, { id: "tag-2", name: "   " }],
  parentCases: [{ id: "parent-1", name: "親案件" }],
  holidays: [{ date: "2026-05-05", type: "company" }, { date: "bad" }]
});
check(normalized.tags.length, 1, "Nameless tags are dropped");
check(normalized.tasks[0].tagIds.length, 1, "Tag references to deleted tags are dropped");
check(normalized.tasks[0].parentCaseId, "", "Dangling parent references are cleared");
check(normalized.holidays.length, 1, "Invalid holidays are dropped");
check(normalized.parentCases[0].caseNumber.includes("P"), true, "Parent case numbers are assigned");
check(
  createDatasetFingerprint(normalizeDataset(normalized)),
  createDatasetFingerprint(normalized),
  "Normalization is stable, so a synced copy does not keep re-uploading itself"
);

// --- sync state ------------------------------------------------------------

saveTodoMemoSyncState({
  userId: "user-a", revision: 7, fingerprint: "abc",
  remoteUpdatedAt: "2026-08-12T00:00:00.000Z", lastSyncedAt: "2026-08-12T00:00:00.000Z"
});
check(loadTodoMemoSyncState("user-a").revision, 7, "Sync state round-trips");
check(
  loadTodoMemoSyncState("user-b").revision,
  0,
  "Another account's revision history must not be inherited"
);
check(
  store.has("todoMemoTasks"),
  false,
  "Sync bookkeeping must not be written into the synced collections"
);

// --- cloud history retention ------------------------------------------------

const day = 86400000;
const now = Date.UTC(2026, 7, 12, 9, 0, 0);
// 40 entries today, then one per day for the previous 40 days.
const history = [
  ...Array.from({ length: 40 }, (_, i) => ({ name: `today-${i}`, date: new Date(now - i * 60000) })),
  ...Array.from({ length: 40 }, (_, i) => ({ name: `day-${i}`, date: new Date(now - (i + 1) * day) }))
];

check(selectExpiredHistory(history.slice(0, 30)).length, 0, "Nothing expires below the recent limit");

const expired = selectExpiredHistory(history);
const kept = history.filter((entry) => !expired.includes(entry));
check(kept.length, 60, "Retention is bounded");
check(
  kept.slice(0, 30).every((entry, index) => entry === history[index]),
  true,
  "The 30 newest restore points are always kept"
);
const keptDays = kept.slice(30).map((entry) => entry.date.toISOString().slice(0, 10));
check(
  new Set(keptDays).size,
  keptDays.length,
  "Older entries are thinned to one per day"
);
check(keptDays.length <= 30, true, "Long-term coverage is capped at 30 days");

check(
  selectExpiredHistory([
    ...Array.from({ length: 31 }, (_, i) => ({ name: `n${i}`, date: new Date(now - i * 60000) })),
    { name: "unreadable", date: null }
  ]).some((entry) => entry.name === "unreadable"),
  false,
  "A restore point with an unreadable timestamp is never deleted"
);

// --- backup validation is shared with the cloud reader ----------------------

const validDocument = {
  format: "TodoMemo Backup",
  schemaVersion: 3,
  tasks: [{ id: "a", title: "タスク" }],
  tags: [],
  sync: { revision: 3 }
};
check(validateBackup(validDocument).sync.revision, 3, "Revision metadata survives validation");
let rejected = false;
try {
  validateBackup({ format: "Other", schemaVersion: 3, tasks: [], tags: [] });
} catch (_error) {
  rejected = true;
}
check(rejected, true, "A foreign document is rejected before it can be applied");

check(describeTodoMemoDevice(), "Windows / Chrome", "Devices are labelled for the conflict prompt");
check(getTodoMemoDeviceId(), getTodoMemoDeviceId(), "The device id is stable across calls");

console.log("Cloud-sync tests: OK");
